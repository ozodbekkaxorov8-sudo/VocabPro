import asyncio

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .catalog import TestDraft, Word, create_draft
from .core import Settings
from .migrate import migrate

SAMPLES = [
    TestDraft(
        title="Food & Drinks",
        description="Ovqatlar va ichimliklarga oid kundalik so‘zlar.",
        class_label="7-A",
        mode="mixed",
        duration_minutes=6,
        words=[
            Word(term="apple", translation="olma", heading="Mevalar"),
            Word(term="pear", translation="nok", heading="Mevalar"),
            Word(term="carrot", translation="sabzi", heading="Sabzavotlar"),
            Word(term="potato", translation="kartoshka", heading="Sabzavotlar"),
            Word(term="tea", translation="choy", heading="Ichimliklar"),
            Word(term="water", translation="suv", heading="Ichimliklar"),
        ],
    ),
    TestDraft(
        title="School Supplies",
        description="Sinfdagi buyumlarning inglizcha nomlarini toping.",
        class_label="7-A",
        mode="matching",
        duration_minutes=5,
        words=[
            Word(term="book", translation="kitob"),
            Word(term="notebook", translation="daftar"),
            Word(term="pencil", translation="qalam"),
            Word(term="ruler", translation="chizg‘ich"),
            Word(term="eraser", translation="o‘chirg‘ich"),
        ],
    ),
]


async def main():
    url = Settings().database_url.get_secret_value()
    async with await AsyncConnection.connect(url, row_factory=dict_row) as db:
        await migrate(db)
        await db.execute("SELECT pg_advisory_xact_lock(60810787200201)")
        for draft in SAMPLES:
            row = await (await db.execute(
                "SELECT id FROM tests WHERE title = %s AND class_key = '7-a'", (draft.title,),
            )).fetchone()
            if row is None:
                test_id = await create_draft(db, draft)
                await db.execute("UPDATE tests SET active = true WHERE id = %s", (test_id,))


if __name__ == "__main__":
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        runner.run(main())
