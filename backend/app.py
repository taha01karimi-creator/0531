
from __future__ import annotations

from pathlib import Path

from flask import Flask, redirect, request, send_from_directory

from api import bp as api_bp
from config import Config
from db import init_db

ROOT_DIR = Path(__file__).resolve().parent.parent

PAGES = {"index.html", "shop.html", "product.html", "cart.html", "admin.html"}
ASSET_DIRS = {"css", "js", "img", "fonts"}

def _no_cache(response):
    response.headers["Cache-Control"] = "no-store"
    return response

def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    app.json.ensure_ascii = False

    init_db(app)
    app.register_blueprint(api_bp)

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        if request.path.startswith("/api/"):
            return _no_cache(response)
        return response

    @app.get("/")
    def home():
        return send_from_directory(ROOT_DIR, "index.html")

    @app.get("/admin")
    def admin_redirect():
        return redirect("/admin.html")

    @app.get("/<page>")
    def page(page: str):
        if page in PAGES:
            return send_from_directory(ROOT_DIR, page)
        return _missing()

    @app.get("/assets/<path:filename>")
    def asset(filename: str):
        top = filename.split("/", 1)[0]
        if top not in ASSET_DIRS:
            return _missing()
        target = (ROOT_DIR / "assets" / filename).resolve()
        assets_root = (ROOT_DIR / "assets").resolve()
        if assets_root not in target.parents and target != assets_root:
            return _missing()
        response = send_from_directory(ROOT_DIR / "assets", filename)
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    def _missing():
        return (
            "<!doctype html><html lang='fa' dir='rtl'><meta charset='utf-8'>"
            "<title>صفحه پیدا نشد</title>"
            "<body style='font-family:sans-serif;padding:40px'>"
            "<h1>۴۰۴</h1><p>این صفحه وجود ندارد. "
            "<a href='/'>بازگشت به فروشگاه</a></p></body></html>",
            404,
            {"Content-Type": "text/html; charset=utf-8"},
        )

    return app
