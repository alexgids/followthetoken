"""Package Follow the Token for static hosting.

Usage: python scripts/build_site.py --url https://followthetoken.com/
"""
import argparse
import datetime
import html
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
# Allowlist keeps tests, screenshots, and tooling out of the public site.
PUBLIC = ['index.html', 'THIRD_PARTY.md', 'assets/styles.css', 'assets/favicon.svg', 'assets/og-image.png', 'assets/fonts', 'js', 'vendor']
# Cloudflare Web Analytics needs its beacon origins; frame-ancestors is omitted so course pages can embed the site.
CSP = ("default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; "
       "object-src 'none'; base-uri 'self'; form-action 'none'")
HEADERS = f"""/*
  Content-Security-Policy: {CSP}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
"""
NOT_FOUND = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found | Follow the Token</title>
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6f8fa;color:#19232e}a{color:#087f7e}</style>
</head>
<body><main><h1>That page is not on the map.</h1><p><a href="HOME_URL">Return to Follow the Token</a></p></main></body>
</html>
"""


def site_url(value):
    parts = urlsplit(value)
    local = parts.hostname in ('localhost', '127.0.0.1')
    if parts.scheme != 'https' and not (parts.scheme == 'http' and local):
        raise argparse.ArgumentTypeError('use https:// (http:// is allowed only for localhost testing)')
    if not parts.hostname or parts.query or parts.fragment or parts.username or parts.password:
        raise argparse.ArgumentTypeError('use a plain site root such as https://followthetoken.com/')
    return value.rstrip('/') + '/'


def main():
    parser = argparse.ArgumentParser(description='Package Follow the Token into dist/ for static hosting.')
    parser.add_argument('--url', required=True, type=site_url, help='Public site root, e.g. https://followthetoken.com/')
    url = parser.parse_args().url
    if DIST.exists():
        shutil.rmtree(DIST)
    for item in PUBLIC:
        source, target = ROOT / item, DIST / item
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            shutil.copy2(source, target)
    page = DIST / 'index.html'
    text = page.read_text(encoding='utf-8')
    if text.count('</head>') != 1:
        sys.exit('index.html must contain exactly one </head>.')
    safe_url = html.escape(url)
    image = html.escape(url + 'assets/og-image.png')
    tags = (f'  <link rel="canonical" href="{safe_url}">\n'
            f'  <meta property="og:url" content="{safe_url}">\n'
            f'  <meta property="og:image" content="{image}">\n'
            f'  <meta name="twitter:image" content="{image}">\n')
    page.write_text(text.replace('</head>', tags + '</head>'), encoding='utf-8')
    today = datetime.date.today().isoformat()
    (DIST / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {url}sitemap.xml\n', encoding='utf-8')
    (DIST / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{safe_url}</loc><lastmod>{today}</lastmod></url>\n</urlset>\n', encoding='utf-8')
    (DIST / '404.html').write_text(NOT_FOUND.replace('HOME_URL', safe_url), encoding='utf-8')
    (DIST / '_headers').write_text(HEADERS, encoding='utf-8')
    (DIST / '.nojekyll').write_text('', encoding='utf-8')
    files = [path for path in DIST.rglob('*') if path.is_file()]
    print(f'Built {len(files)} files ({sum(path.stat().st_size for path in files) / 1e6:.1f} MB) in {DIST} for {url}')


if __name__ == '__main__':
    main()
