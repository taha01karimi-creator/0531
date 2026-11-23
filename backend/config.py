
from __future__ import annotations

import os
import secrets
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
DATA_DIR = Path(os.environ.get("SHOP_DATA_DIR") or (BACKEND_DIR / "data")).resolve()
DB_PATH = Path(os.environ.get("SHOP_DB_PATH") or (DATA_DIR / "shop.db"))
SECRET_FILE = DATA_DIR / "secret_key"

def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

load_env_file(BACKEND_DIR / ".env")

IS_PRODUCTION = os.environ.get("SHOP_ENV", "development").lower() == "production"

def _secret_key() -> str:
    value = (os.environ.get("SECRET_KEY") or "").strip()
    if value:
        return value
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if SECRET_FILE.exists():
        stored = SECRET_FILE.read_text(encoding="utf-8").strip()
        if stored:
            return stored
    value = secrets.token_urlsafe(48)
    SECRET_FILE.write_text(value, encoding="utf-8")
    try:
        SECRET_FILE.chmod(0o600)
    except OSError:
        pass
    return value

class Config:
    SECRET_KEY = _secret_key()
    SESSION_COOKIE_NAME = "shop_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = IS_PRODUCTION
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 8
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024
    JSON_AS_ASCII = False

    ADMIN_USERNAME = (os.environ.get("ADMIN_USERNAME") or "admin").strip()
    ADMIN_PASSWORD = (os.environ.get("ADMIN_PASSWORD") or "").strip()
    DATA_DIR = DATA_DIR
    DB_PATH = DB_PATH
    IS_PRODUCTION = IS_PRODUCTION
    SITE_NAME = "CODELAINE"
