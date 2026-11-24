from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints, model_validator

from .auth import StudentSession, TeacherSession, class_key, clean
from .core import DB
from .grading import normalize

student_router = APIRouter(prefix="/student/tests", tags=["catalog"])
teacher_router = APIRouter(prefix="/teacher/tests", tags=["catalog"], dependencies=[TeacherSession])
Mode = Literal["written", "matching", "headings", "mixed"]
ShortWord = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class Word(BaseModel):
    term: ShortWord
    translation: ShortWord
    heading: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] = ""


class TestDraft(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=400)] = ""
    class_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=24)] = ""
    mode: Mode = "mixed"
    duration_minutes: int = Field(default=8, ge=1, le=60)
    words: list[Word] = Field(min_length=2, max_length=80)

    @model_validator(mode="after")
    def check_words(self):
        terms = {normalize(word.term) for word in self.words}
        if len(terms) != len(self.words):
            raise ValueError("Lug‘atdagi har bir so‘z bir marta kiritilishi kerak.")
        if self.mode in {"matching", "mixed"} and len({normalize(word.translation) for word in self.words}) < 2:
            raise ValueError("Moslashtirish uchun kamida ikkita turli tarjima kiriting.")
        headings = {normalize(word.heading) for word in self.words}
        if self.mode == "headings" or (self.mode == "mixed" and headings != {""}):
            minimum = 3 if self.mode == "mixed" else 2
            if len(self.words) < minimum or "" in headings or len(headings) < 2:
                raise ValueError(f"Guruhlash uchun kamida {minimum} ta so‘z va ikkita turli guruh kerak. Har bir so‘zga guruh kiriting.")
        if self.class_label and not class_key(self.class_label):
            raise ValueError("Sinf nomini to‘g‘ri kiriting.")
        return self


class ActiveUpdate(BaseModel):
    active: bool


SUMMARY = """
    SELECT t.id, t.title, t.description, t.class_label, t.mode, t.duration_minutes, t.active,
           (SELECT count(*) FROM vocabulary v WHERE v.test_id = t.id) AS word_count
    FROM tests t
"""


async def list_words(db, test_id: int):
    return await (await db.execute(
        "SELECT term, translation, heading FROM vocabulary WHERE test_id = %s ORDER BY position",
        (test_id,),
    )).fetchall()


async def write_words(db, test_id: int, draft: TestDraft) -> None:
    await db.execute("DELETE FROM vocabulary WHERE test_id = %s", (test_id,))
    headings = {}
    rows = []
    for position, word in enumerate(draft.words):
        heading = headings.setdefault(normalize(word.heading), clean(word.heading))
        rows.append((test_id, position, clean(word.term), clean(word.translation), heading))
    async with db.cursor() as cursor:
        await cursor.executemany(
            "INSERT INTO vocabulary (test_id, position, term, translation, heading) VALUES (%s, %s, %s, %s, %s)",
            rows,
        )


def draft_params(draft: TestDraft) -> tuple:
    return draft.title, draft.description, draft.class_label.upper(), class_key(draft.class_label), draft.mode, draft.duration_minutes


async def create_draft(db, draft: TestDraft) -> int:
    row = await (await db.execute(
        """INSERT INTO tests (title, description, class_label, class_key, mode, duration_minutes)
           VALUES (%s, %s, %s, resolve_class_key(%s), %s, %s) RETURNING id""",
        draft_params(draft),
    )).fetchone()
    await write_words(db, row["id"], draft)
    return row["id"]


@student_router.get("")
async def student_tests(db: DB, student: StudentSession):
    return await (await db.execute(
        SUMMARY + "WHERE t.active AND t.class_key IN ('', resolve_class_key(%s)) ORDER BY t.updated_at DESC, t.id DESC",
        (class_key(student.class_label),),
    )).fetchall()


@student_router.get("/{test_id}/study")
async def study_words(test_id: int, db: DB, student: StudentSession):
    rows = await (await db.execute(
        """SELECT v.term, v.translation, v.heading FROM tests t JOIN vocabulary v ON v.test_id = t.id
           WHERE t.id = %s AND t.active AND t.class_key IN ('', resolve_class_key(%s)) ORDER BY v.position""",
        (test_id, class_key(student.class_label)),
    )).fetchall()
    if not rows:
        raise HTTPException(404, "Bu lug‘at hozir mavjud emas.")
    return rows


@teacher_router.get("")
async def teacher_tests(db: DB):
    return await (await db.execute(SUMMARY + "ORDER BY t.updated_at DESC, t.id DESC")).fetchall()


@teacher_router.get("/{test_id}")
async def teacher_test(test_id: int, db: DB):
    row = await (await db.execute(
        SUMMARY + "WHERE t.id = %s FOR SHARE OF t", (test_id,)
    )).fetchone()
    if row is None:
        raise HTTPException(404, "Lug‘at topilmadi.")
    return {**row, "words": await list_words(db, test_id)}


@teacher_router.post("", status_code=201)
async def create_test(draft: TestDraft, db: DB):
    return {"id": await create_draft(db, draft)}


@teacher_router.put("/{test_id}")
async def update_test(test_id: int, draft: TestDraft, db: DB):
    result = await db.execute(
        """UPDATE tests SET title = %s, description = %s, class_label = %s, class_key = resolve_class_key(%s), mode = %s,
           duration_minutes = %s, updated_at = now() WHERE id = %s""",
        (*draft_params(draft), test_id),
    )
    if not result.rowcount:
        raise HTTPException(404, "Lug‘at topilmadi.")
    await write_words(db, test_id, draft)
    return {"id": test_id}


@teacher_router.patch("/{test_id}/active")
async def set_active(test_id: int, data: ActiveUpdate, db: DB):
    result = await db.execute(
        "UPDATE tests SET active = %s, updated_at = now() WHERE id = %s", (data.active, test_id),
    )
    if not result.rowcount:
        raise HTTPException(404, "Lug‘at topilmadi.")
    return {"active": data.active}
