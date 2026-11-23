
from __future__ import annotations

import json
import re
import secrets

from flask import Blueprint, jsonify, request, session

from db import ORDER_STATUSES, get_db, now_iso
from security import (
    SESSION_USER_KEY,
    client_ip,
    csrf_valid,
    current_admin,
    issue_csrf_token,
    login_required,
    mutation_guard,
    rate_limited,
    reset_rate_limit,
    same_origin,
    verify_password,
)

bp = Blueprint("api", __name__, url_prefix="/api")

PHONE_RE = re.compile(r"^09\d{9}$")
MAX_QTY = 10

def _json_list(raw: str) -> list:
    try:
        value = json.loads(raw or "[]")
        return value if isinstance(value, list) else []
    except (TypeError, ValueError):
        return []

def _product(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "price": row["price"],
        "oldPrice": row["old_price"],
        "images": _json_list(row["images"]),
        "colors": _json_list(row["colors"]),
        "sizes": _json_list(row["sizes"]),
        "rating": row["rating"],
        "reviews": row["reviews"],
        "sales": row["sales"],
        "addedAt": row["added_at"],
        "material": row["material"],
        "fit": row["fit"],
        "desc": row["description"],
        "active": bool(row["active"]),
    }

def _settings() -> dict:
    rows = get_db().execute("SELECT key, value FROM settings").fetchall()
    values = {}
    for row in rows:
        try:
            values[row["key"]] = json.loads(row["value"])
        except (TypeError, ValueError):
            values[row["key"]] = row["value"]
    coupons = values.get("coupons") if isinstance(values.get("coupons"), dict) else {}
    return {
        "shippingCost": int(values.get("shipping_cost") or 0),
        "freeShippingFrom": int(values.get("free_shipping_from") or 0),
        "coupons": coupons,
    }

def _order_items(code: str) -> list[dict]:
    rows = get_db().execute(
        "SELECT product_id, name, size, color, qty, price FROM order_items WHERE code = ? ORDER BY id",
        (code,),
    ).fetchall()
    return [
        {
            "productId": row["product_id"],
            "name": row["name"],
            "size": row["size"],
            "color": row["color"],
            "qty": row["qty"],
            "price": row["price"],
        }
        for row in rows
    ]

def _public_order(row) -> dict:
    return {
        "code": row["code"],
        "createdAt": row["created_at"],
        "status": row["status"],
        "items": _order_items(row["code"]),
        "subtotal": row["subtotal"],
        "discount": row["discount"],
        "shipping": row["shipping"],
        "total": row["total"],
        "coupon": row["coupon"],
    }

def _admin_order(row) -> dict:
    order = _public_order(row)
    order.update(
        {
            "name": row["name"],
            "phone": row["phone"],
            "city": row["city"],
            "address": row["address"],
        }
    )
    return order

def _new_order_code() -> str:
    connection = get_db()
    for _ in range(20):
        code = "CL-" + secrets.token_hex(3).upper()
        found = connection.execute(
            "SELECT 1 FROM orders WHERE code = ?", (code,)
        ).fetchone()
        if not found:
            return code
    raise RuntimeError("ساخت کد سفارش ممکن نشد")

def _clean_text(value, limit: int) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit]

def _bad(message: str, status: int = 400):
    return jsonify({"error": message}), status

@bp.get("/health")
def health():
    return jsonify({"ok": True, "name": "codelaine-shop"})

@bp.get("/csrf")
def csrf():
    response = jsonify({"ok": True})
    token = issue_csrf_token(response)
    response.headers["Cache-Control"] = "no-store"
    response.set_data(json.dumps({"ok": True, "token": token}, ensure_ascii=False))
    response.content_type = "application/json; charset=utf-8"
    return response

@bp.get("/products")
def products():
    rows = get_db().execute(
        "SELECT * FROM products WHERE active = 1 ORDER BY added_at DESC, name"
    ).fetchall()
    return jsonify({"products": [_product(row) for row in rows]})

@bp.get("/products/<product_id>")
def product_detail(product_id: str):
    row = get_db().execute(
        "SELECT * FROM products WHERE id = ? AND active = 1", (product_id,)
    ).fetchone()
    if not row:
        return _bad("محصول پیدا نشد", 404)
    return jsonify({"product": _product(row)})

@bp.get("/settings")
def public_settings():
    return jsonify({"settings": _settings()})

@bp.post("/orders")
@mutation_guard
def create_order():
    if rate_limited("orders", client_ip(), limit=20, window=60):
        return _bad("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید", 429)

    payload = request.get_json(silent=True) or {}
    items = payload.get("items")
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}

    name = _clean_text(customer.get("name"), 80)
    phone = "".join(str(customer.get("phone") or "").split()).replace("-", "")
    city = _clean_text(customer.get("city"), 60)
    address = _clean_text(customer.get("address"), 400)

    if len(name) < 3:
        return _bad("نام و نام خانوادگی را کامل وارد کنید")
    if not PHONE_RE.match(phone):
        return _bad("شمارهٔ موبایل معتبر نیست (مثال: 09121234567)")
    if len(city) < 2:
        return _bad("نام شهر را وارد کنید")
    if len(address) < 10:
        return _bad("آدرس را کامل‌تر وارد کنید")
    if not isinstance(items, list) or not items:
        return _bad("سبد خرید خالی است")

    connection = get_db()
    lines: list[dict] = []
    subtotal = 0
    for raw in items:
        if not isinstance(raw, dict):
            return _bad("اقلام سفارش معتبر نیستند")
        product_row = connection.execute(
            "SELECT * FROM products WHERE id = ? AND active = 1",
            (str(raw.get("product_id") or ""),),
        ).fetchone()
        if not product_row:
            return _bad("یکی از محصول‌های سبد خرید دیگر موجود نیست")
        try:
            qty = int(raw.get("qty") or 0)
        except (TypeError, ValueError):
            return _bad("تعداد محصول معتبر نیست")
        if not 1 <= qty <= MAX_QTY:
            return _bad("تعداد هر محصول باید بین ۱ تا ۱۰ باشد")

        size = _clean_text(raw.get("size"), 20)
        color = _clean_text(raw.get("color"), 20)
        sizes = _json_list(product_row["sizes"])
        colors = _json_list(product_row["colors"])
        if sizes and size not in sizes:
            return _bad("سایز انتخاب‌شده معتبر نیست")
        if colors and color and color not in colors:
            return _bad("رنگ انتخاب‌شده معتبر نیست")

        price = int(product_row["price"])
        lines.append(
            {
                "product_id": product_row["id"],
                "name": product_row["name"],
                "size": size,
                "color": color,
                "qty": qty,
                "price": price,
            }
        )
        subtotal += price * qty

    settings = _settings()
    coupon = _clean_text(payload.get("coupon"), 32).upper()
    discount = 0
    if coupon:
        found = settings["coupons"].get(coupon)
        percent = int(found.get("percent") or 0) if isinstance(found, dict) else 0
        if percent > 0:
            discount = round(subtotal * percent / 100)
        else:
            coupon = ""
    shipping = 0 if subtotal >= settings["freeShippingFrom"] else settings["shippingCost"]
    total = max(0, subtotal - discount) + shipping

    code = _new_order_code()
    connection.execute(
        """
        INSERT INTO orders
          (code, created_at, status, name, phone, city, address, coupon,
           subtotal, discount, shipping, total)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            code,
            now_iso(),
            "pending",
            name,
            phone,
            city,
            address,
            coupon,
            subtotal,
            discount,
            shipping,
            total,
        ),
    )
    for line in lines:
        connection.execute(
            """
            INSERT INTO order_items (code, product_id, name, size, color, qty, price)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                code,
                line["product_id"],
                line["name"],
                line["size"],
                line["color"],
                line["qty"],
                line["price"],
            ),
        )
    connection.commit()

    row = connection.execute("SELECT * FROM orders WHERE code = ?", (code,)).fetchone()
    return jsonify({"order": _public_order(row)}), 201

@bp.get("/orders/track")
def track_order():
    code = _clean_text(request.args.get("code"), 32).upper()
    phone = "".join(str(request.args.get("phone") or "").split())
    if not code:
        return _bad("کد رهگیری را وارد کنید")
    if rate_limited("track", client_ip(), limit=30, window=60):
        return _bad("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید", 429)

    row = get_db().execute("SELECT * FROM orders WHERE code = ?", (code,)).fetchone()
    if not row or (phone and row["phone"] != phone):
        return _bad("سفارشی با این کد پیدا نشد", 404)
    return jsonify({"order": _public_order(row)})

@bp.get("/auth/me")
def auth_me():
    user = current_admin()
    if not user:
        return _bad("وارد نشده‌اید", 401)
    return jsonify({"user": user})

@bp.post("/auth/login")
def auth_login():
    if not same_origin():
        return _bad("درخواست از دامنهٔ دیگری رد شد", 403)
    if not csrf_valid():
        return _bad("توکن امنیتی نامعتبر است؛ صفحه را تازه کنید", 403)

    payload = request.get_json(silent=True) or {}
    username = _clean_text(payload.get("username"), 80)
    password = str(payload.get("password") or "")
    if not username or not password:
        return _bad("نام کاربری و رمز عبور را وارد کنید")

    bucket = f"{client_ip()}|{username.lower()}"
    if rate_limited("login", bucket, limit=5, window=600):
        return _bad("تلاش‌های ناموفق زیاد بوده؛ چند دقیقه بعد دوباره تلاش کنید", 429)

    row = get_db().execute(
        "SELECT username, password_hash FROM admins WHERE username = ?", (username,)
    ).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return _bad("نام کاربری یا رمز عبور اشتباه است", 401)

    reset_rate_limit("login", bucket)
    user = {"username": row["username"], "role": "owner", "title": "مدیر فروشگاه"}
    session.clear()
    session[SESSION_USER_KEY] = user
    session.permanent = True

    response = jsonify({"user": user})
    issue_csrf_token(response)
    return response

@bp.post("/auth/logout")
@login_required
def auth_logout():
    session.clear()
    return jsonify({"ok": True})

@bp.get("/admin/products")
@login_required
def admin_products():
    rows = get_db().execute(
        "SELECT * FROM products ORDER BY added_at DESC, name"
    ).fetchall()
    return jsonify({"products": [_product(row) for row in rows]})

def _product_payload(payload: dict, *, partial_from: dict | None = None) -> tuple[dict, str | None]:
    base = dict(partial_from or {})

    def pick(key, default=""):
        return payload[key] if key in payload else base.get(key, default)

    product_id = _clean_text(pick("id"), 60).lower()
    name = _clean_text(pick("name"), 200)
    category = _clean_text(pick("category"), 40)
    desc = str(pick("desc") or "").strip()[:2000]
    material = _clean_text(pick("material"), 80)
    fit = _clean_text(pick("fit"), 80)
    added_at = _clean_text(pick("addedAt"), 20)

    try:
        price = int(pick("price", 0))
        old_price = int(pick("oldPrice", 0) or 0)
        reviews = int(pick("reviews", 0) or 0)
        sales = int(pick("sales", 0) or 0)
        rating = float(pick("rating", 0) or 0)
    except (TypeError, ValueError):
        return {}, "مقدارهای عددی محصول معتبر نیستند"

    def as_list(key):
        value = pick(key, [])
        if isinstance(value, str):
            value = [part.strip() for part in value.split(",") if part.strip()]
        if not isinstance(value, list):
            return []
        return [str(part).strip() for part in value if str(part).strip()]

    images = as_list("images")
    colors = as_list("colors")
    sizes = as_list("sizes")

    if partial_from is None and not re.match(r"^[a-z0-9][a-z0-9-]{1,59}$", product_id):
        return {}, "شناسهٔ محصول باید با حروف کوچک انگلیسی و خط تیره باشد"
    if len(name) < 3:
        return {}, "نام محصول را کامل وارد کنید"
    if not category:
        return {}, "دستهٔ محصول را انتخاب کنید"
    if price <= 0:
        return {}, "قیمت محصول باید بیشتر از صفر باشد"
    if old_price and old_price < price:
        return {}, "قیمت قبل از تخفیف نباید کمتر از قیمت فعلی باشد"
    if not images:
        return {}, "حداقل یک تصویر لازم است"
    if not 0 <= rating <= 5:
        return {}, "امتیاز باید بین ۰ تا ۵ باشد"

    return {
        "id": product_id,
        "name": name,
        "category": category,
        "price": price,
        "old_price": old_price,
        "images": images,
        "colors": colors,
        "sizes": sizes,
        "rating": round(rating, 1),
        "reviews": max(0, reviews),
        "sales": max(0, sales),
        "added_at": added_at,
        "material": material,
        "fit": fit,
        "description": desc,
    }, None

@bp.post("/admin/products")
@login_required
def admin_product_create():
    payload = request.get_json(silent=True) or {}
    values, error = _product_payload(payload)
    if error:
        return _bad(error)
    connection = get_db()
    if connection.execute("SELECT 1 FROM products WHERE id = ?", (values["id"],)).fetchone():
        return _bad("محصولی با این شناسه از قبل هست")
    connection.execute(
        """
        INSERT INTO products
          (id, name, category, price, old_price, images, colors, sizes,
           rating, reviews, sales, added_at, material, fit, description)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            values["id"],
            values["name"],
            values["category"],
            values["price"],
            values["old_price"],
            json.dumps(values["images"], ensure_ascii=False),
            json.dumps(values["colors"], ensure_ascii=False),
            json.dumps(values["sizes"], ensure_ascii=False),
            values["rating"],
            values["reviews"],
            values["sales"],
            values["added_at"] or now_iso()[:10],
            values["material"],
            values["fit"],
            values["description"],
        ),
    )
    connection.commit()
    row = connection.execute("SELECT * FROM products WHERE id = ?", (values["id"],)).fetchone()
    return jsonify({"product": _product(row)}), 201

@bp.put("/admin/products/<product_id>")
@login_required
def admin_product_update(product_id: str):
    connection = get_db()
    current = connection.execute(
        "SELECT * FROM products WHERE id = ?", (product_id,)
    ).fetchone()
    if not current:
        return _bad("محصول پیدا نشد", 404)

    base = {
        **_product(current),
        "desc": current["description"],
        "addedAt": current["added_at"],
    }
    values, error = _product_payload(request.get_json(silent=True) or {}, partial_from=base)
    if error:
        return _bad(error)

    connection.execute(
        """
        UPDATE products SET name=?, category=?, price=?, old_price=?, images=?,
          colors=?, sizes=?, rating=?, reviews=?, sales=?, added_at=?,
          material=?, fit=?, description=?, active=?
        WHERE id=?
        """,
        (
            values["name"],
            values["category"],
            values["price"],
            values["old_price"],
            json.dumps(values["images"], ensure_ascii=False),
            json.dumps(values["colors"], ensure_ascii=False),
            json.dumps(values["sizes"], ensure_ascii=False),
            values["rating"],
            values["reviews"],
            values["sales"],
            values["added_at"] or current["added_at"],
            values["material"],
            values["fit"],
            values["description"],
            1 if (request.get_json(silent=True) or {}).get("active", True) else 0,
            product_id,
        ),
    )
    connection.commit()
    row = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return jsonify({"product": _product(row)})

@bp.delete("/admin/products/<product_id>")
@login_required
def admin_product_delete(product_id: str):
    connection = get_db()
    found = connection.execute("SELECT 1 FROM products WHERE id = ?", (product_id,)).fetchone()
    if not found:
        return _bad("محصول پیدا نشد", 404)

    connection.execute("UPDATE products SET active = 0 WHERE id = ?", (product_id,))
    connection.commit()
    return jsonify({"ok": True})

@bp.get("/admin/orders")
@login_required
def admin_orders():
    status = _clean_text(request.args.get("status"), 20)
    search = _clean_text(request.args.get("q"), 60)
    sql = "SELECT * FROM orders"
    params: list = []
    clauses = []
    if status and status in ORDER_STATUSES:
        clauses.append("status = ?")
        params.append(status)
    if search:
        clauses.append("(code LIKE ? OR name LIKE ? OR phone LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like])
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC LIMIT 200"
    rows = get_db().execute(sql, params).fetchall()
    return jsonify({"orders": [_admin_order(row) for row in rows]})

@bp.get("/admin/orders/<code>")
@login_required
def admin_order_detail(code: str):
    row = get_db().execute(
        "SELECT * FROM orders WHERE code = ?", (code.upper(),)
    ).fetchone()
    if not row:
        return _bad("سفارش پیدا نشد", 404)
    return jsonify({"order": _admin_order(row)})

@bp.put("/admin/orders/<code>")
@login_required
def admin_order_update(code: str):
    payload = request.get_json(silent=True) or {}
    status = _clean_text(payload.get("status"), 20)
    if status not in ORDER_STATUSES:
        return _bad("وضعیت سفارش معتبر نیست")
    connection = get_db()
    found = connection.execute(
        "SELECT 1 FROM orders WHERE code = ?", (code.upper(),)
    ).fetchone()
    if not found:
        return _bad("سفارش پیدا نشد", 404)
    connection.execute("UPDATE orders SET status = ? WHERE code = ?", (status, code.upper()))
    connection.commit()
    row = connection.execute(
        "SELECT * FROM orders WHERE code = ?", (code.upper(),)
    ).fetchone()
    return jsonify({"order": _admin_order(row)})

@bp.get("/admin/settings")
@login_required
def admin_settings_get():
    return jsonify({"settings": _settings()})

@bp.put("/admin/settings")
@login_required
def admin_settings_put():
    payload = request.get_json(silent=True) or {}
    try:
        shipping = int(payload.get("shippingCost", 0))
        free_from = int(payload.get("freeShippingFrom", 0))
    except (TypeError, ValueError):
        return _bad("مقدارهای ارسال معتبر نیستند")
    if shipping < 0 or free_from < 0:
        return _bad("مقدارهای ارسال نمی‌توانند منفی باشند")

    coupons = payload.get("coupons", {})
    cleaned: dict[str, dict] = {}
    if not isinstance(coupons, dict):
        return _bad("کدهای تخفیف معتبر نیستند")
    for raw_code, value in coupons.items():
        code = _clean_text(raw_code, 32).upper()
        if not code:
            continue
        if not isinstance(value, dict):
            return _bad("کد تخفیف معتبر نیست")
        try:
            percent = int(value.get("percent", 0))
        except (TypeError, ValueError):
            return _bad("درصد کد تخفیف معتبر نیست")
        if not 1 <= percent <= 90:
            return _bad("درصد کد تخفیف باید بین ۱ تا ۹۰ باشد")
        cleaned[code] = {"percent": percent, "label": _clean_text(value.get("label"), 80)}

    connection = get_db()
    for key, value in (
        ("shipping_cost", shipping),
        ("free_shipping_from", free_from),
        ("coupons", cleaned),
    ):
        connection.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(value, ensure_ascii=False)),
        )
    connection.commit()
    return jsonify({"settings": _settings()})

@bp.get("/admin/stats")
@login_required
def admin_stats():
    connection = get_db()
    products_count = connection.execute(
        "SELECT COUNT(*) AS n FROM products WHERE active = 1"
    ).fetchone()["n"]
    orders = connection.execute("SELECT * FROM orders").fetchall()
    revenue = sum(row["total"] for row in orders if row["status"] != "cancelled")
    by_status: dict[str, int] = {status: 0 for status in ORDER_STATUSES}
    for row in orders:
        by_status[row["status"]] = by_status.get(row["status"], 0) + 1
    by_category = {
        row["category"]: row["n"]
        for row in connection.execute(
            "SELECT category, COUNT(*) AS n FROM products WHERE active = 1 GROUP BY category"
        ).fetchall()
    }
    return jsonify(
        {
            "stats": {
                "products": products_count,
                "orders": len(orders),
                "revenue": revenue,
                "byStatus": by_status,
                "byCategory": by_category,
            },
            "recent": [_admin_order(row) for row in orders[:5]],
        }
    )
