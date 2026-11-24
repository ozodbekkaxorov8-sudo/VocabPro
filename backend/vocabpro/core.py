from collections.abc import AsyncIterator
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, Request
from psycopg import AsyncConnection
from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    database_url: SecretStr
    session_secret: SecretStr
    teacher_code: SecretStr
    app_origin: str = "http://127.0.0.1:3000"
    secure_cookies: bool = True
    telegram_bot_token: SecretStr | None = None
    db_pool_size: int = 12

    @field_validator("session_secret", "teacher_code")
    @classmethod
    def require_length(cls, secret: SecretStr, info) -> SecretStr:
        minimum = 32 if info.field_name == "session_secret" else 8
        if len(secret.get_secret_value()) < minimum:
            raise ValueError(f"Kamida {minimum} belgi bo‘lishi kerak")
        return secret

    @field_validator("app_origin")
    @classmethod
    def validate_origin(cls, value: str) -> str:
        url = urlsplit(value)
        if url.scheme not in {"http", "https"} or not url.netloc or url.path or url.query or url.fragment:
            raise ValueError("APP_ORIGIN faqat sxema, domen va portni o‘z ichiga oladi")
        return value


async def connection(request: Request) -> AsyncIterator[AsyncConnection]:
    async with request.app.state.pool.connection() as db:
        yield db


DB = Annotated[AsyncConnection, Depends(connection, scope="function")]
