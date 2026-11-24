from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, StringConstraints

from .auth import StudentSession, class_key
from .catalog import list_words
from .core import DB
from .grading import build_questions, normalize, score

router = APIRouter(prefix="/student", tags=["attempts"])
LEASE = "90 seconds"


class Start(BaseModel):
    id: UUID


class Progress(BaseModel):
    revision: int = Field(ge=0, le=1_000_000)
    answers: dict[
        Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]?$")],
        Annotated[str, StringConstraints(max_length=120)],
    ] = Field(max_length=80)


class Finish(Progress):
    reason: Literal["submitted", "fullscreen_exit", "time_limit"] = "submitted"


def public_attempt(attempt: dict) -> dict:
    result = {key: attempt[key] for key in (
        "id", "test_title", "expires_at", "finished_at", "reason", "correct_count", "total_count"
    )}
    if not attempt["finished_at"]:
        result["remaining_seconds"] = max(0, (attempt["expires_at"] - datetime.now(timezone.utc)).total_seconds())
        result["questions"] = [
            {key: question[key] for key in ("id", "kind", "term", "options")} for question in attempt["questions"]
        ]
        result["answers"] = attempt["answers"]
        result["revision"] = attempt["revision"]
    return result


async def finalize(db, attempt: dict, reason: str) -> dict:
    correct = score(attempt["questions"], attempt["answers"])
    row = await (await db.execute(
        """UPDATE attempts SET finished_at = clock_timestamp(), reason = %s, correct_count = %s,
               answers = %s, revision = %s WHERE id = %s RETURNING *""",
        (reason, correct, Jsonb(attempt["answers"]), attempt["revision"], attempt["id"]),
    )).fetchone()
    percent = round(100 * correct / row["total_count"])
    message = (
        f"VocabPro · Yangi test natijasi\n{row['student_name']} · {row['class_label']}\n"
        f"{row['test_title']}\nNatija: {correct}/{row['total_count']} ({percent}%)"
    )
    await db.execute(
        """INSERT INTO telegram_outbox (attempt_id, chat_id, message)
           SELECT %s, chat_id, %s FROM telegram_setting WHERE singleton""",
        (row["id"], message),
    )
    return row


def due_reason(attempt: dict) -> str | None:
    now = datetime.now(timezone.utc)
    if min(attempt["lease_until"], attempt["expires_at"]) > now:
        return None
    return "time_limit" if attempt["expires_at"] <= attempt["lease_until"] else "disconnected"


async def load_locked(db, attempt_id: UUID, session_id: UUID):
    return await (await db.execute(
        "SELECT * FROM attempts WHERE id = %s AND session_id = %s FOR UPDATE", (attempt_id, session_id)
    )).fetchone()


@router.post("/tests/{test_id}/attempts", status_code=201)
async def start_attempt(test_id: int, data: Start, db: DB, student: StudentSession):
    existing = await load_locked(db, data.id, student.id)
    if existing:
        if existing["test_id"] != test_id:
            raise HTTPException(409, "Urinish boshqa testga tegishli.")
        if not existing["finished_at"] and (expired := due_reason(existing)):
            existing = await finalize(db, existing, expired)
        return public_attempt(existing)
    test = await (await db.execute(
        "SELECT * FROM tests WHERE id = %s AND active AND class_key IN ('', resolve_class_key(%s)) FOR SHARE",
        (test_id, class_key(student.class_label)),
    )).fetchone()
    if test is None:
        raise HTTPException(404, "Bu test hozir mavjud emas.")
    live = await (await db.execute(
        "SELECT * FROM attempts WHERE session_id = %s AND test_id = %s AND finished_at IS NULL FOR UPDATE",
        (student.id, test_id),
    )).fetchone()
    if live:
        expired = due_reason(live)
        if not expired:
            raise HTTPException(409, "Bu test boshqa oynada ochilgan. Uni yakunlang yoki 90 soniya kuting.")
        await finalize(db, live, expired)
    questions = build_questions(await list_words(db, test_id), test["mode"])
    row = await (await db.execute(
        """INSERT INTO attempts (id, session_id, test_id, test_title, student_name, student_key,
               class_label, class_key, questions, expires_at, lease_until, total_count)
           VALUES (%s, %s, %s, %s, %s, %s, %s, resolve_class_key(%s), %s,
               clock_timestamp() + make_interval(mins => %s), clock_timestamp() + %s::interval, %s)
           ON CONFLICT DO NOTHING RETURNING *""",
        (data.id, student.id, test_id, test["title"], student.name, normalize(student.name),
         student.class_label, class_key(student.class_label), Jsonb(questions), test["duration_minutes"], LEASE, len(questions)),
    )).fetchone()
    if row is None:
        row = await load_locked(db, data.id, student.id)
        if row is None or row["test_id"] != test_id:
            raise HTTPException(409, "Bu test boshqa oynada ochilgan.")
    return public_attempt(row)


@router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: UUID, db: DB, student: StudentSession):
    attempt = await load_locked(db, attempt_id, student.id)
    if not attempt:
        raise HTTPException(404, "Natija topilmadi.")
    if not attempt["finished_at"] and (expired := due_reason(attempt)):
        attempt = await finalize(db, attempt, expired)
    return public_attempt(attempt)


async def update_attempt(db, attempt_id: UUID, session_id: UUID, data: Progress, reason: str | None):
    attempt = await load_locked(db, attempt_id, session_id)
    if not attempt:
        raise HTTPException(404, "Urinish topilmadi.")
    if attempt["finished_at"]:
        return attempt
    if expired := due_reason(attempt):
        return await finalize(db, attempt, expired)
    if data.revision > attempt["revision"]:
        ids = {item["id"] for item in attempt["questions"]}
        if data.answers.keys() - ids:
            raise HTTPException(422, "Javob test savollariga mos kelmaydi.")
        attempt.update(answers=data.answers, revision=data.revision)
    if reason and reason != "time_limit":
        return await finalize(db, attempt, reason)
    return await (await db.execute(
        """UPDATE attempts SET answers = %s, revision = %s, lease_until = clock_timestamp() + %s::interval
           WHERE id = %s RETURNING *""",
        (Jsonb(attempt["answers"]), attempt["revision"], LEASE, attempt_id),
    )).fetchone()


@router.put("/attempts/{attempt_id}/progress")
async def save_progress(attempt_id: UUID, data: Progress, db: DB, student: StudentSession):
    attempt = await update_attempt(db, attempt_id, student.id, data, None)
    if attempt["finished_at"]:
        return public_attempt(attempt)
    return {"revision": attempt["revision"], "finished_at": None}


@router.post("/attempts/{attempt_id}/finish")
async def finish_attempt(attempt_id: UUID, data: Finish, db: DB, student: StudentSession):
    return public_attempt(await update_attempt(db, attempt_id, student.id, data, data.reason))


async def close_expired(db) -> None:
    attempts = await (await db.execute(
        """SELECT * FROM attempts WHERE finished_at IS NULL AND least(expires_at, lease_until) <= now()
           ORDER BY least(expires_at, lease_until) LIMIT 40 FOR UPDATE SKIP LOCKED"""
    )).fetchall()
    for attempt in attempts:
        await finalize(db, attempt, due_reason(attempt) or "disconnected")
