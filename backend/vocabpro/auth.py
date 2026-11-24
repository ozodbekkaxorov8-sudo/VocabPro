import hmac
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from itsdangerous import BadData, URLSafeTimedSerializer
from pydantic import BaseModel, StringConstraints

from .core import DB

router = APIRouter(prefix="/session", tags=["session"])
STUDENT_AGE = 60 * 60 * 12
TEACHER_AGE = 60 * 60 * 8


def clean(value: str) -> str:
    return " ".join(value.split())


def class_key(label: str) -> str:
    return "".join(label.casefold().replace("–", "-").replace("—", "-").split()).removesuffix("-sinf")


class StudentLogin(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    class_label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]


class Student(StudentLogin):
    id: UUID


class TeacherLogin(BaseModel):
    code: Annotated[str, StringConstraints(min_length=1, max_length=128)]


def serializer(request: Request, role: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(request.app.state.settings.session_secret.get_secret_value(), salt=f"vocabpro-{role}")


def read_session(request: Request, role: str, age: int) -> dict:
    try:
        return serializer(request, role).loads(request.cookies.get(f"vp_{role}", ""), max_age=age)
    except BadData:
        raise HTTPException(401, "Avval panelga kiring.") from None


def set_session(request: Request, response: Response, role: str, data: dict, age: int) -> None:
    response.set_cookie(
        f"vp_{role}", serializer(request, role).dumps(data), max_age=age,
        httponly=True, secure=request.app.state.settings.secure_cookies, samesite="strict",
    )


def student_session(request: Request) -> Student:
    return Student.model_validate(read_session(request, "student", STUDENT_AGE))


def teacher_session(request: Request) -> None:
    read_session(request, "teacher", TEACHER_AGE)


StudentSession = Annotated[Student, Depends(student_session)]
TeacherSession = Depends(teacher_session)


@router.post("/student", response_model=StudentLogin)
async def login_student(data: StudentLogin, request: Request, response: Response) -> Student:
    label = clean(data.class_label).upper()
    if not class_key(label):
        raise HTTPException(422, "Sinf nomini to‘g‘ri kiriting.")
    student = Student(id=uuid4(), name=clean(data.name), class_label=label)
    set_session(request, response, "student", student.model_dump(mode="json"), STUDENT_AGE)
    return student


@router.get("/student", response_model=StudentLogin)
async def current_student(student: StudentSession) -> Student:
    return student


@router.delete("/student", status_code=204)
async def logout_student(response: Response) -> None:
    response.delete_cookie("vp_student")


@router.post("/teacher", status_code=204)
async def login_teacher(data: TeacherLogin, request: Request, response: Response, db: DB) -> None:
    bucket = request.client.host if request.client else "unknown"
    configured = request.app.state.settings.teacher_code.get_secret_value()
    valid = hmac.compare_digest(data.code.encode(), configured.encode())
    async with db.transaction():
        row = await (await db.execute(
            """INSERT INTO login_limits (bucket, window_start, failures) VALUES (%s, now(), 1)
               ON CONFLICT (bucket) DO UPDATE SET
               failures = CASE WHEN login_limits.window_start < now() - interval '10 minutes'
                               THEN 1 ELSE least(login_limits.failures + 1, 9) END,
               window_start = CASE WHEN login_limits.window_start < now() - interval '10 minutes'
                                   THEN now() ELSE login_limits.window_start END
               RETURNING failures""",
            (bucket,),
        )).fetchone()
        limited = row["failures"] > 8
        if valid and not limited:
            await db.execute("DELETE FROM login_limits WHERE bucket = %s", (bucket,))
    if limited:
        raise HTTPException(429, "Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring.")
    if not valid:
        raise HTTPException(401, "Kirish kodi noto‘g‘ri.")
    set_session(request, response, "teacher", {"id": str(uuid4())}, TEACHER_AGE)


@router.get("/teacher", status_code=204, dependencies=[TeacherSession])
async def current_teacher() -> None:
    pass


@router.delete("/teacher", status_code=204)
async def logout_teacher(response: Response) -> None:
    response.delete_cookie("vp_teacher")
