# Chimney Pro

Job ticket tracker: paste a ticket, add line items and costs, track parts
cost, scheduled date, whether a repair team is needed, and deposit
amount/method. Jobs land in a list where you can edit or copy the ticket
as formatted text.

## Stack

- `client/` — React + TypeScript (Vite)
- `server/` — Express + TypeScript + SQLite (`better-sqlite3`)

## Run

```bash
npm run install:all   # first time only
npm run dev           # runs server (:4000) and client (:5173) together
```

Open http://localhost:5173. The client proxies `/api/*` to the server.

The SQLite database file (`server/chimney-pro.db`) is created automatically
and gitignored.
