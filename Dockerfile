FROM ghcr.io/astral-sh/uv:0.13.7 AS uv

FROM node:24-bookworm-slim AS web-build
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://127.0.0.1:8001
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim-bookworm AS api-build
WORKDIR /app/backend
COPY --from=uv /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.13-slim-bookworm
ENV PATH="/app/backend/.venv/bin:$PATH" \
    HOME=/tmp PYTHONUNBUFFERED=1 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 DB_POOL_SIZE=4
RUN apt-get update \
    && apt-get install -y --no-install-recommends libatomic1 libgomp1 libstdc++6 tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 vocabpro

COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=web-build --chown=vocabpro /app/frontend/.next/standalone /app/frontend/
COPY --from=web-build /app/frontend/.next/static /app/frontend/.next/static/
COPY --from=web-build /app/frontend/public /app/frontend/public/
COPY --from=api-build /app/backend/.venv /app/backend/.venv/
COPY backend/vocabpro/ /app/backend/vocabpro/
COPY --chmod=755 deploy/start.sh /usr/local/bin/vocabpro-start

WORKDIR /app/backend
USER vocabpro
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/vocabpro-start"]
