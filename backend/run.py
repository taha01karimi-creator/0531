
from __future__ import annotations

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    host = os.environ.get("SHOP_HOST", "127.0.0.1")
    port = int(os.environ.get("SHOP_PORT", "5000"))
    is_production = os.environ.get("SHOP_ENV", "development").lower() == "production"
    debug = not is_production and os.environ.get("SHOP_DEBUG", "1") == "1"
    app.run(host=host, port=port, debug=debug)
