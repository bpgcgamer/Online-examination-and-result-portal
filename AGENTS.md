# AGENTS.md

## Purpose
This file helps AI coding agents become productive quickly in this DBMS project.

## Start Here
1. Read [README.md](README.md) for setup and role mapping.
2. Read [server.js](server.js) for API patterns and runtime behavior.
3. Read [schema.sql](schema.sql) for the data model.

## Run Commands
- Install Node dependencies: `npm install`
- Start API + static frontend: `npm start`
- Open app: `http://localhost:4000`
- Install Python connector dependency: `pip install mysql-connector-python`
- Run CLI connector: `python python_connector.py`

No automated test suite is defined in [package.json](package.json). Use manual verification and [server.js](server.js) health endpoint: `GET /api/health`.

## Environment
Set DB connection values used by [db.js](db.js):
- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `3306`)
- `DB_USER` (default `root`)
- `DB_PASSWORD` (default empty)
- `DB_NAME` (default `online_exam_portal`)

Runtime values used by [server.js](server.js):
- `PORT` (default `4000`)
- `GEMINI_API_KEY` (optional; enables AI doubt assistant)
- `GEMINI_API_URL` and `GEMINI_MODEL` (optional overrides)

## Database Setup Order (Critical)
Run SQL files in this order:
1. [schema.sql](schema.sql)
2. [advanced_db.sql](advanced_db.sql)
3. [data_seed.sql](data_seed.sql)
4. [queries.sql](queries.sql)

Do not change this order. Features like trigger-based attempt tracking depend on it.

## Codebase Map
- Backend API: [server.js](server.js)
- DB pool/config: [db.js](db.js)
- Frontend: [index.html](index.html), [app.js](app.js), [styles.css](styles.css)
- Python CLI: [python_connector.py](python_connector.py)
- SQL sources: [schema.sql](schema.sql), [advanced_db.sql](advanced_db.sql), [data_seed.sql](data_seed.sql), [queries.sql](queries.sql)

## Working Conventions
- Keep SQL-first changes in SQL files; do not patch production DB manually.
- Follow existing endpoint style in [server.js](server.js): async handlers, parameterized queries, JSON error responses.
- Keep schema/seed/query files consistent whenever columns or constraints change.
- Prefer minimal, targeted edits; avoid unrelated refactors.

## Typical Task Routing
- New endpoint or API bug: [server.js](server.js)
- DB constraint/procedure/trigger issue: [schema.sql](schema.sql), [advanced_db.sql](advanced_db.sql)
- Seed/demo data updates: [data_seed.sql](data_seed.sql)
- Reporting/query changes: [queries.sql](queries.sql)
- UI flow changes: [app.js](app.js), [index.html](index.html), [styles.css](styles.css)
- CLI flow changes: [python_connector.py](python_connector.py)

## Common Pitfalls
- SQL files run out of order -> missing trigger/procedure/view behavior.
- Missing DB env vars -> connection failures in [db.js](db.js).
- Assuming tests exist -> verify manually via UI, CLI, and `/api/health`.

## Related Docs
- Main project documentation: [README.md](README.md)
