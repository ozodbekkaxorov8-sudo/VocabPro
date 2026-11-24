FROM ghcr.io/astral-sh/uv:0.13.7 AS uv
FROM python:3.13-slim AS build
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.13-slim
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOME=/tmp
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 vocabpro
WORKDIR /app
COPY --from=build /app/.venv .venv
COPY vocabpro ./vocabpro
USER vocabpro
EXPOSE 8000
CMD ["uvicorn", "vocabpro.main:app", "--host", "0.0.0.0", "--port", "8000"]
