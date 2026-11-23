
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       INTEGER NOT NULL,
    old_price   INTEGER NOT NULL DEFAULT 0,
    images      TEXT NOT NULL DEFAULT '[]',
    colors      TEXT NOT NULL DEFAULT '[]',
    sizes       TEXT NOT NULL DEFAULT '[]',
    rating      REAL NOT NULL DEFAULT 0,
    reviews     INTEGER NOT NULL DEFAULT 0,
    sales       INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT NOT NULL DEFAULT '',
    material    TEXT NOT NULL DEFAULT '',
    fit         TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
    code       TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    city       TEXT NOT NULL,
    address    TEXT NOT NULL,
    coupon     TEXT NOT NULL DEFAULT '',
    subtotal   INTEGER NOT NULL DEFAULT 0,
    discount   INTEGER NOT NULL DEFAULT 0,
    shipping   INTEGER NOT NULL DEFAULT 0,
    total      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL REFERENCES orders(code) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    size       TEXT NOT NULL DEFAULT '',
    color      TEXT NOT NULL DEFAULT '',
    qty        INTEGER NOT NULL DEFAULT 1,
    price      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_code ON order_items(code);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
"""

ORDER_STATUSES = ("pending", "processing", "shipped", "delivered", "cancelled")

DEFAULT_SETTINGS = {
    "shipping_cost": 49000,
    "free_shipping_from": 5000000,
    "coupons": {"CODE10": {"percent": 10, "label": "ده درصد تخفیف"}},
}

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def connect(path: str) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection

def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect(str(current_app.config["DB_PATH"]))
    return g.db

def close_db(_error=None) -> None:
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()

def init_db(app) -> None:
    app.config["DATA_DIR"].mkdir(parents=True, exist_ok=True)
    connection = connect(str(app.config["DB_PATH"]))
    try:
        connection.executescript(SCHEMA)
        connection.commit()
        _seed_settings(connection, app.config["DATA_DIR"])
        _seed_products(connection, app.config["DATA_DIR"])
        _seed_admin(connection, app)
    finally:
        connection.close()
    app.teardown_appcontext(close_db)

def _seed_settings(connection: sqlite3.Connection, data_dir) -> None:
    defaults = dict(DEFAULT_SETTINGS)
    source = data_dir / "settings.json"
    if source.exists():
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                defaults.update(payload)
        except ValueError:
            pass

    for key, value in defaults.items():
        connection.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, json.dumps(value, ensure_ascii=False)),
        )
    connection.commit()

def _seed_products(connection: sqlite3.Connection, data_dir) -> None:
    existing = connection.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"]
    if existing:
        return
    source = data_dir / "products.json"
    if not source.exists():
        return
    payload = json.loads(source.read_text(encoding="utf-8"))
    for product in payload.get("products", []):
        connection.execute(
            """
            INSERT OR IGNORE INTO products
              (id, name, category, price, old_price, images, colors, sizes,
               rating, reviews, sales, added_at, material, fit, description)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                product["id"],
                product["name"],
                product.get("category", ""),
                int(product.get("price", 0)),
                int(product.get("oldPrice") or 0),
                json.dumps(product.get("images", []), ensure_ascii=False),
                json.dumps(product.get("colors", []), ensure_ascii=False),
                json.dumps(product.get("sizes", []), ensure_ascii=False),
                float(product.get("rating") or 0),
                int(product.get("reviews") or 0),
                int(product.get("sales") or 0),
                product.get("addedAt", ""),
                product.get("material", ""),
                product.get("fit", ""),
                product.get("desc", ""),
            ),
        )
    connection.commit()

def _seed_admin(connection: sqlite3.Connection, app) -> None:
    if connection.execute("SELECT COUNT(*) AS n FROM admins").fetchone()["n"]:
        return
    from security import hash_password

    password = app.config["ADMIN_PASSWORD"]
    if not password:
        password = secrets.token_urlsafe(9)

        password_file = app.config["DATA_DIR"] / "admin_password.txt"
        password_file.write_text(password, encoding="utf-8")
        try:
            password_file.chmod(0o600)
        except OSError:
            pass
        app.logger.warning(
            "رمز مدیر ساخته شد و در %s ذخیره شد (برای تغییر، ADMIN_PASSWORD را ست کنید)",
            password_file,
        )
    connection.execute(
        "INSERT INTO admins (username, password_hash, created_at) VALUES (?,?,?)",
        (app.config["ADMIN_USERNAME"], hash_password(password), now_iso()),
    )
    connection.commit()
