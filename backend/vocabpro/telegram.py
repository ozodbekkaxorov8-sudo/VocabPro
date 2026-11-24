import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .attempts import close_expired
from .auth import TeacherSession
from .core import DB

router = APIRouter(prefix="/teacher/telegram", tags=["telegram"], dependencies=[TeacherSession])
log = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


class TelegramSetting(BaseModel):
    chat_id: int | None = Field(default=None, ge=-(2**52), le=2**52)


@router.get("")
async def telegram_settings(request: Request, db: DB):
    row = await (await db.execute("SELECT chat_id FROM telegram_setting WHERE singleton")).fetchone()
    return {"configured": bool(request.app.state.settings.telegram_bot_token), "chat_id": row["chat_id"] if row else None}


@router.put("")
async def save_telegram(data: TelegramSetting, request: Request, db: DB):
    if data.chat_id is None:
        await db.execute("DELETE FROM telegram_setting")
        await db.execute("UPDATE telegram_outbox SET abandoned_at = now() WHERE delivered_at IS NULL AND abandoned_at IS NULL")
    else:
        if not data.chat_id or not request.app.state.settings.telegram_bot_token:
            raise HTTPException(422, "Avval bot tokenini sozlang va chat ID ni tekshiring.")
        await db.execute(
            """INSERT INTO telegram_setting (singleton, chat_id) VALUES (true, %s)
               ON CONFLICT (singleton) DO UPDATE SET chat_id = excluded.chat_id""",
            (data.chat_id,),
        )
        await db.execute(
            """UPDATE telegram_outbox SET abandoned_at = now()
               WHERE delivered_at IS NULL AND abandoned_at IS NULL AND chat_id <> %s""", (data.chat_id,),
        )
    return {"chat_id": data.chat_id}


async def claim_message(db):
    return await (await db.execute(
        """WITH ready AS (
             SELECT attempt_id FROM telegram_outbox
             WHERE delivered_at IS NULL AND abandoned_at IS NULL AND next_at <= now()
             ORDER BY next_at LIMIT 1 FOR UPDATE SKIP LOCKED
           )
           UPDATE telegram_outbox box SET next_at = now() + interval '30 seconds'
           FROM ready WHERE box.attempt_id = ready.attempt_id
           RETURNING box.attempt_id, box.chat_id, box.message, box.retries""",
    )).fetchone()


async def deliver(pool, client: httpx.AsyncClient, token: str, message: dict) -> None:
    delivered = False
    delay = 30 * 2 ** message["retries"]
    try:
        response = await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": message["chat_id"], "text": message["message"]},
        )
        delivered = response.is_success and bool(response.json().get("ok"))
        if response.status_code == 429:
            delay = max(delay, int(response.json().get("parameters", {}).get("retry_after", 0)))
    except (httpx.HTTPError, ValueError):
        pass
    async with pool.connection() as db:
        if delivered:
            await db.execute("UPDATE telegram_outbox SET delivered_at = now() WHERE attempt_id = %s", (message["attempt_id"],))
        else:
            await db.execute(
                """UPDATE telegram_outbox SET retries = retries + 1,
                   abandoned_at = CASE WHEN retries >= 5 THEN now() ELSE abandoned_at END,
                   next_at = now() + make_interval(secs => %s) WHERE attempt_id = %s""",
                (delay, message["attempt_id"]),
            )


async def run_housekeeping(pool, token: str | None) -> None:
    async with httpx.AsyncClient(timeout=8) as client:
        while True:
            try:
                async with pool.connection() as db:
                    await close_expired(db)
                if token:
                    for _ in range(10):
                        async with pool.connection() as db:
                            message = await claim_message(db)
                        if not message:
                            break
                        await deliver(pool, client, token, message)
            except Exception:
                log.exception("Background housekeeping failed")
            await asyncio.sleep(5)
