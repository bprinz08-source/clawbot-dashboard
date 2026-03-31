#!/usr/bin/env python3

import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key, value)


def load_env() -> None:
    load_env_file(Path(".env.local"))
    load_env_file(Path(".env"))


def get_supabase_config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_role_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    )

    if not url or not service_role_key:
        raise RuntimeError(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    return url, service_role_key


def supabase_request(path: str, query: dict[str, str]) -> object:
    base_url, service_role_key = get_supabase_config()
    url = f"{base_url}{path}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
    )

    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase request failed ({error.code}) for {path}: {error_body}"
        ) from error


def fetch_one_row(table: str, query: dict[str, str]) -> dict[str, object] | None:
    payload = supabase_request(f"/rest/v1/{table}", query)
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected Supabase response for {table}.")

    if not payload:
        return None

    row = payload[0]
    if not isinstance(row, dict):
        raise RuntimeError(f"Unexpected Supabase row shape for {table}.")

    return row


def normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def decode_duckduckgo_url(url: str) -> str:
    if url.startswith("//"):
        url = f"https:{url}"

    parsed = urllib.parse.urlparse(url)
    if "duckduckgo.com" not in parsed.netloc:
        return url

    query = urllib.parse.parse_qs(parsed.query)
    direct_url = query.get("uddg", [""])[0]
    return urllib.parse.unquote(direct_url) if direct_url else url


def search_duckduckgo(query: str) -> list[dict[str, str]]:
    url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            html_text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"DuckDuckGo search failed ({error.code}) for query '{query}': {error_body}"
        ) from error

    pattern = re.compile(
        r'class="result__a" href="(?P<href>[^"]+)".*?>(?P<title>.*?)</a>',
        flags=re.DOTALL,
    )

    results: list[dict[str, str]] = []
    for match in pattern.finditer(html_text):
        raw_href = html.unescape(match.group("href"))
        direct_url = decode_duckduckgo_url(raw_href)
        parsed_url = urllib.parse.urlparse(direct_url)
        if parsed_url.scheme not in {"http", "https"}:
            continue

        title = html.unescape(re.sub(r"<[^>]+>", "", match.group("title"))).strip()
        if not title:
            continue

        results.append(
            {
                "title": title,
                "url": direct_url,
                "source_label": parsed_url.netloc.lower(),
                "query": query,
            }
        )

    return results


def build_queries(title: str, brand: str, model: str) -> list[str]:
    product_terms = " ".join(part for part in [brand, model, title] if part)
    return [
        f"{product_terms} manual pdf",
        f"{product_terms} spec sheet",
        f"{product_terms} warranty",
    ]


def find_manual_links_for_intake_item(intake_item_id: str) -> dict[str, object]:
    intake_item = fetch_one_row(
        "intake_items",
        {
            "select": "*",
            "id": f"eq.{intake_item_id}",
            "limit": "1",
        },
    )
    if intake_item is None:
        raise RuntimeError(f"Intake item not found: {intake_item_id}")

    import_target_type = normalize_text(intake_item.get("import_target_type"))
    import_target_id = normalize_text(intake_item.get("import_target_id"))
    if import_target_type != "product_instance" or not import_target_id:
        raise RuntimeError("Intake item is not linked to a live product_instance.")

    product = fetch_one_row(
        "product_instances",
        {
            "select": "*",
            "id": f"eq.{import_target_id}",
            "limit": "1",
        },
    )
    if product is None:
        raise RuntimeError(f"Linked product_instance not found: {import_target_id}")

    title = normalize_text(intake_item.get("title"))
    brand = normalize_text(intake_item.get("brand")) or normalize_text(product.get("brand"))
    model = normalize_text(intake_item.get("model_number")) or normalize_text(product.get("model"))
    if not brand or not model:
        raise RuntimeError("Manual search requires brand and model.")

    queries = build_queries(title, brand, model)
    candidates: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for query in queries:
        for result in search_duckduckgo(query):
            normalized_url = result["url"].rstrip("/")
            if normalized_url in seen_urls:
                continue
            seen_urls.add(normalized_url)
            candidates.append(result)
            if len(candidates) >= 5:
                break
        if len(candidates) >= 5:
            break

    return {
        "intake_item_id": intake_item_id,
        "product_instance_id": import_target_id,
        "product": {
            "title": title,
            "brand": brand,
            "model": model,
            "category": normalize_text(product.get("category")),
        },
        "queries": queries,
        "candidates": candidates,
    }


def main(argv: list[str]) -> int:
    load_env()

    if len(argv) != 2:
        print(
            "Usage: python3 scripts/find_manual_links_for_intake_item.py <intake_item_id>",
            file=sys.stderr,
        )
        return 1

    intake_item_id = argv[1].strip()
    if not intake_item_id:
        print("intake_item_id is required.", file=sys.stderr)
        return 1

    summary = find_manual_links_for_intake_item(intake_item_id)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
