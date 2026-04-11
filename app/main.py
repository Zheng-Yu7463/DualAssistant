from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parent.parent
APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "dual_ledger.sqlite3"

Currency = Literal["CNY", "USD"]
EntryType = Literal["income", "expense"]


class EntryIn(BaseModel):
    type: EntryType
    currency: Currency
    amount: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=160)
    occurred_at: str | None = None


class ExchangeIn(BaseModel):
    from_currency: Currency
    to_currency: Currency
    from_amount: float = Field(gt=0)
    to_amount: float = Field(gt=0)
    exchange_rate: float = Field(gt=0)
    note: str = Field(default="", max_length=160)
    occurred_at: str | None = None


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]


def require_existing(conn: sqlite3.Connection, table: str, item_id: str) -> None:
    exists = conn.execute(f"select 1 from {table} where id = ?", (item_id,)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="记录不存在")


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            create table if not exists entries (
                id text primary key,
                type text not null check (type in ('income', 'expense')),
                currency text not null check (currency in ('CNY', 'USD')),
                amount real not null,
                category text not null,
                note text not null,
                occurred_at text not null,
                created_at text not null
            );

            create table if not exists exchanges (
                id text primary key,
                from_currency text not null check (from_currency in ('CNY', 'USD')),
                to_currency text not null check (to_currency in ('CNY', 'USD')),
                from_amount real not null,
                to_amount real not null,
                exchange_rate real not null,
                note text not null,
                occurred_at text not null,
                created_at text not null
            );
            """
        )


def list_entries(conn: sqlite3.Connection, filter_by: str = "all", limit: int | None = None) -> list[dict]:
    params: list[str] = []
    where = ""
    if filter_by != "all":
        currency, kind = filter_by.split("_", 1)
        where = "where currency = ? and type = ?"
        params = [currency.upper(), kind]
    query = f"select * from entries {where} order by occurred_at desc, created_at desc"
    if limit:
        query += " limit ?"
        params.append(str(limit))
    return rows_to_dicts(conn.execute(query, params).fetchall())


def list_exchanges(conn: sqlite3.Connection, limit: int | None = None) -> list[dict]:
    query = "select * from exchanges order by occurred_at desc, created_at desc"
    params: list[str] = []
    if limit:
        query += " limit ?"
        params.append(str(limit))
    rows = rows_to_dicts(conn.execute(query, params).fetchall())
    for row in rows:
        row["kind"] = "exchange"
    return rows


def combined_records(entries: list[dict], exchanges: list[dict], limit: int | None = None) -> list[dict]:
    records = [dict(row, kind="entry") for row in entries] + exchanges
    records.sort(key=lambda row: (row["occurred_at"], row["created_at"]), reverse=True)
    return records[:limit] if limit else records


def totals_for(rows: list[sqlite3.Row] | list[dict]) -> dict:
    totals = {
        "CNY": {"income": 0.0, "expense": 0.0, "net": 0.0},
        "USD": {"income": 0.0, "expense": 0.0, "net": 0.0},
    }
    for row in rows:
        currency = row["currency"]
        kind = row["type"]
        totals[currency][kind] += float(row["amount"])
    for currency in ("CNY", "USD"):
        totals[currency]["income"] = round(totals[currency]["income"], 2)
        totals[currency]["expense"] = round(totals[currency]["expense"], 2)
        totals[currency]["net"] = round(totals[currency]["income"] - totals[currency]["expense"], 2)
    return totals


def category_totals(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        select currency, type, category, round(sum(amount), 2) as total
        from entries
        group by currency, type, category
        order by currency, type, total desc
        """
    ).fetchall()
    return rows_to_dicts(rows)


def exchange_stats(rows: list[dict]) -> dict:
    directions = {
        "CNY_USD": {
            "key": "CNY_USD",
            "label": "CNY → USD",
            "from_currency": "CNY",
            "to_currency": "USD",
            "count": 0,
            "from_total": 0.0,
            "to_total": 0.0,
            "avg_rate": 0.0,
        },
        "USD_CNY": {
            "key": "USD_CNY",
            "label": "USD → CNY",
            "from_currency": "USD",
            "to_currency": "CNY",
            "count": 0,
            "from_total": 0.0,
            "to_total": 0.0,
            "avg_rate": 0.0,
        },
    }
    rate_sums = {"CNY_USD": 0.0, "USD_CNY": 0.0}

    for row in rows:
        key = f"{row['from_currency']}_{row['to_currency']}"
        if key not in directions:
            continue
        direction = directions[key]
        direction["count"] += 1
        direction["from_total"] += float(row["from_amount"])
        direction["to_total"] += float(row["to_amount"])
        rate_sums[key] += float(row["exchange_rate"])

    for key, direction in directions.items():
        direction["from_total"] = round(direction["from_total"], 2)
        direction["to_total"] = round(direction["to_total"], 2)
        direction["avg_rate"] = round(rate_sums[key] / direction["count"], 6) if direction["count"] else 0.0

    return {"count": len(rows), "directions": directions}


def build_summary(conn: sqlite3.Connection) -> dict:
    all_rows = rows_to_dicts(conn.execute("select * from entries order by occurred_at desc, created_at desc").fetchall())
    exchange_rows = list_exchanges(conn)
    month_prefix = datetime.now().strftime("%Y-%m")
    month_rows = [row for row in all_rows if row["occurred_at"].startswith(month_prefix)]
    month_exchange_rows = [row for row in exchange_rows if row["occurred_at"].startswith(month_prefix)]
    return {
        "all_time": totals_for(all_rows),
        "monthly": totals_for(month_rows),
        "entry_count": len(all_rows),
        "exchange_count": len(exchange_rows),
        "exchange_stats": exchange_stats(exchange_rows),
        "monthly_exchange_stats": exchange_stats(month_exchange_rows),
        "recent_entries": combined_records(all_rows, exchange_rows, 6),
        "category_totals": category_totals(conn),
    }


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Dual Ledger", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if (ROOT_DIR / "stitch_exports").exists():
    app.mount("/stitch_exports", StaticFiles(directory=ROOT_DIR / "stitch_exports"), name="stitch_exports")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    return FileResponse(STATIC_DIR / "assets" / "profile.png", media_type="image/png")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    with get_conn() as conn:
        return {
            "entries": list_entries(conn),
            "exchanges": list_exchanges(conn),
            "records": combined_records(list_entries(conn), list_exchanges(conn)),
            "summary": build_summary(conn),
        }


@app.get("/api/entries")
def entries(
    filter_by: str = Query("all", pattern="^(all|cny_income|cny_expense|usd_income|usd_expense)$"),
) -> list[dict]:
    with get_conn() as conn:
        return list_entries(conn, filter_by)


@app.get("/api/exchanges")
def exchanges() -> list[dict]:
    with get_conn() as conn:
        return list_exchanges(conn)


@app.post("/api/entries", status_code=201)
def create_entry(payload: EntryIn) -> dict:
    with get_conn() as conn:
        conn.execute(
            "insert into entries values (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"entry-{uuid4().hex[:12]}",
                payload.type,
                payload.currency,
                round(payload.amount, 2),
                payload.category,
                payload.note,
                payload.occurred_at or now_iso(),
                now_iso(),
            ),
        )
        conn.commit()
    return bootstrap()


@app.put("/api/entries/{entry_id}")
def update_entry(entry_id: str, payload: EntryIn) -> dict:
    with get_conn() as conn:
        require_existing(conn, "entries", entry_id)
        conn.execute(
            """
            update entries
            set type = ?, currency = ?, amount = ?, category = ?, note = ?, occurred_at = ?
            where id = ?
            """,
            (
                payload.type,
                payload.currency,
                round(payload.amount, 2),
                payload.category,
                payload.note,
                payload.occurred_at or now_iso(),
                entry_id,
            ),
        )
        conn.commit()
    return bootstrap()


@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: str) -> dict:
    with get_conn() as conn:
        require_existing(conn, "entries", entry_id)
        conn.execute("delete from entries where id = ?", (entry_id,))
        conn.commit()
    return bootstrap()


@app.post("/api/exchanges", status_code=201)
def create_exchange(payload: ExchangeIn) -> dict:
    if payload.from_currency == payload.to_currency:
        raise HTTPException(status_code=400, detail="换汇方向必须是两个不同币种")
    with get_conn() as conn:
        conn.execute(
            "insert into exchanges values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"exchange-{uuid4().hex[:12]}",
                payload.from_currency,
                payload.to_currency,
                round(payload.from_amount, 2),
                round(payload.to_amount, 2),
                round(payload.exchange_rate, 6),
                payload.note,
                payload.occurred_at or now_iso(),
                now_iso(),
            ),
        )
        conn.commit()
    return bootstrap()


@app.put("/api/exchanges/{exchange_id}")
def update_exchange(exchange_id: str, payload: ExchangeIn) -> dict:
    if payload.from_currency == payload.to_currency:
        raise HTTPException(status_code=400, detail="换汇方向必须是两个不同币种")
    with get_conn() as conn:
        require_existing(conn, "exchanges", exchange_id)
        conn.execute(
            """
            update exchanges
            set from_currency = ?, to_currency = ?, from_amount = ?, to_amount = ?,
                exchange_rate = ?, note = ?, occurred_at = ?
            where id = ?
            """,
            (
                payload.from_currency,
                payload.to_currency,
                round(payload.from_amount, 2),
                round(payload.to_amount, 2),
                round(payload.exchange_rate, 6),
                payload.note,
                payload.occurred_at or now_iso(),
                exchange_id,
            ),
        )
        conn.commit()
    return bootstrap()


@app.delete("/api/exchanges/{exchange_id}")
def delete_exchange(exchange_id: str) -> dict:
    with get_conn() as conn:
        require_existing(conn, "exchanges", exchange_id)
        conn.execute("delete from exchanges where id = ?", (exchange_id,))
        conn.commit()
    return bootstrap()


@app.get("/api/transactions")
def transactions_alias(
    filter_by: str = Query("all", pattern="^(all|cny_income|cny_expense|usd_income|usd_expense|exchange)$"),
) -> list[dict]:
    if filter_by == "exchange":
        return exchanges()
    return entries(filter_by)


@app.post("/api/transactions", status_code=201)
def create_transaction_alias(payload: EntryIn) -> dict:
    return create_entry(payload)


@app.get("/api/reports")
def reports() -> dict:
    with get_conn() as conn:
        return build_summary(conn)
