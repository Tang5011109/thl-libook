#!/usr/bin/env python3
"""Build a fully self-contained single-file version of 泰合礼 for offline Android use."""
from __future__ import annotations

import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
ASSETS = {
    "assets/icon-64.png": "image/png",
    "assets/icon-180.png": "image/png",
    "assets/icon-192.png": "image/png",
    "assets/icon-512.png": "image/png",
}
SCRIPTS = [
    "core.js",
    "files.js",
    "export.js",
    "ui.js",
    "home.js",
    "records.js",
    "stats.js",
    "people.js",
    "settings.js",
    "tools.js",
    "app.js",
]


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css/app.css").read_text(encoding="utf-8")

    # Standalone mode has no access to the web manifest, service worker or adjacent assets.
    html = re.sub(r'\n\s*<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r'\n\s*<link rel="apple-touch-icon"[^>]*>', "", html)
    html = re.sub(
        r'\n\s*<link rel="icon"[^>]*>',
        '\n  <link rel="icon" href="assets/icon-64.png">',
        html,
    )
    html = html.replace(
        '<link rel="stylesheet" href="css/app.css">',
        "<style>\n" + css + "\n</style>",
    )
    for name in SCRIPTS:
        path = ROOT / "js" / name
        code = path.read_text(encoding="utf-8")
        if "</script" in code.lower():
            raise SystemExit(f"Refusing to inline {name}: contains </script")
        html = html.replace(
            f'<script src="js/{name}"></script>',
            "<script>\n" + code + "\n</script>",
        )

    # Embed images. Do the longest references first in case of substring collisions.
    for asset in sorted(ASSETS, key=len, reverse=True):
        path = ROOT / asset
        if not path.exists():
            raise SystemExit(f"Missing asset: {asset}")
        html = html.replace(asset, data_uri(path, ASSETS[asset]))

    html = html.replace(
        "<title>泰合礼 · 礼金簿</title>",
        "<title>泰合礼 · 礼金簿（离线单文件版）</title>\n  <!-- 泰合礼 THL 礼金簿 · 离线单文件版：所有脚本、样式和图标已内联。 -->",
    )
    DIST.mkdir(exist_ok=True)
    out = DIST / "泰合礼-礼金簿.html"
    out.write_text(html, encoding="utf-8")
    size = out.stat().st_size
    print(f"Built {out} ({size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
