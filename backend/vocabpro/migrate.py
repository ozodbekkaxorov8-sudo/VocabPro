from pathlib import Path

from psycopg import AsyncConnection


async def migrate(db: AsyncConnection) -> None:
    async with db.transaction():
        await db.execute("SELECT pg_advisory_xact_lock(4910486309843321)")
        await db.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, "
            "applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {row["version"] for row in await (await db.execute("SELECT version FROM schema_migrations")).fetchall()}
        for migration in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
            if migration.stem in applied:
                continue
            await db.execute(migration.read_text(encoding="utf-8"), prepare=False)
            await db.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (migration.stem,))
