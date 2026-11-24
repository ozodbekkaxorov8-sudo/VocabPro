import asyncio
from contextlib import asynccontextmanager, suppress

import anyio
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from . import attempts, auth, catalog, imports, results, telegram
from .core import Settings
from .migrate import migrate


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    app.state.settings = settings
    app.state.ocr_limiter = anyio.CapacityLimiter(1)
    app.state.pool = AsyncConnectionPool(
        settings.database_url.get_secret_value(), min_size=1, max_size=settings.db_pool_size,
        timeout=5, kwargs={"row_factory": dict_row}, open=False,
    )
    async with app.state.pool as pool:
        await pool.wait(timeout=10)
        async with pool.connection() as db:
            await migrate(db)
        token = settings.telegram_bot_token
        job = asyncio.create_task(telegram.run_housekeeping(pool, token.get_secret_value() if token else None))
        try:
            yield
        finally:
            job.cancel()
            with suppress(asyncio.CancelledError):
                await job


app = FastAPI(title="VocabPro API", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)


@app.middleware("http")
async def protect_requests(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if (origin and origin != request.app.state.settings.app_origin) or request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "So‘rov manzili ruxsat etilmagan."}, status_code=403)
    if request.url.path.endswith("/teacher/import"):
        size = request.headers.get("content-length", "")
        if size.isdecimal() and int(size) > imports.MAX_SIZE + 65536:
            return JSONResponse({"detail": "Fayl hajmi 8 MB dan oshmasligi kerak."}, status_code=413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    error = exc.errors()[0]
    detail = error["msg"].removeprefix("Value error, ") if error["type"] == "value_error" else "Kiritilgan ma’lumotlarni tekshiring."
    return JSONResponse({"detail": detail}, status_code=422)


@app.get("/api/health")
async def health():
    async with app.state.pool.connection(timeout=2) as db:
        await db.execute("SELECT 1")
    return {"status": "ok"}


@app.get("/api/live", include_in_schema=False)
async def live():
    return {"status": "ok"}


for router in (auth.router, catalog.student_router, catalog.teacher_router, attempts.router, results.router, imports.router, telegram.router):
    app.include_router(router, prefix="/api")
