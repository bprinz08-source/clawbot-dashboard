#!/usr/bin/env python3

import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CSV_FIELD_SECTION = "section"
CSV_FIELD_ITEM_NAME = "item_name"
CSV_FIELD_BRAND = "brand"
CSV_FIELD_MODEL = "model_or_product_info"
CSV_FIELD_PROJECT_NAME = "project_name"


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


def supabase_request(
    method: str,
    path: str,
    *,
    query: dict[str, str] | None = None,
    body: dict[str, object] | None = None,
    content_type: str | None = "application/json",
) -> object:
    base_url, service_role_key = get_supabase_config()
    url = f"{base_url}{path}"

    if query:
        encoded_query = urllib.parse.urlencode(query)
        url = f"{url}?{encoded_query}"

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }

    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        if content_type:
            headers["Content-Type"] = content_type
        headers["Prefer"] = "return=representation"

    request = urllib.request.Request(url, data=payload, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request) as response:
            raw_response = response.read()
            if not raw_response:
                return None
            return json.loads(raw_response.decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase request failed ({error.code}) for {path}: {error_body}"
        ) from error


def fetch_one_row(table: str, query: dict[str, str]) -> dict[str, object] | None:
    payload = supabase_request(
        "GET",
        f"/rest/v1/{table}",
        query=query,
    )

    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected Supabase response for {table}.")

    if not payload:
        return None

    row = payload[0]
    if not isinstance(row, dict):
        raise RuntimeError(f"Unexpected Supabase row shape for {table}.")

    return row


def fetch_rows(table: str, query: dict[str, str]) -> list[dict[str, object]]:
    payload = supabase_request("GET", f"/rest/v1/{table}", query=query)
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected Supabase response for {table}.")

    rows: list[dict[str, object]] = []
    for row in payload:
        if isinstance(row, dict):
            rows.append(row)
    return rows


def insert_row(table: str, payload: dict[str, object]) -> dict[str, object]:
    response = supabase_request(
        "POST",
        f"/rest/v1/{table}",
        query={"select": "*"},
        body=payload,
    )

    if not isinstance(response, list) or not response or not isinstance(response[0], dict):
        raise RuntimeError(f"Unexpected Supabase insert response for {table}.")

    return response[0]


def download_storage_text(storage_path: str) -> str:
    bucket, object_path = storage_path.split("/", 1)
    base_url, service_role_key = get_supabase_config()
    url = (
        f"{base_url}/storage/v1/object/{bucket}/"
        f"{urllib.parse.quote(object_path, safe='/')}"
    )
    request = urllib.request.Request(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
    )

    try:
        with urllib.request.urlopen(request) as response:
            return response.read().decode("utf-8-sig")
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase storage download failed ({error.code}) for {storage_path}: {error_body}"
        ) from error


def normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def is_csv_like(source_file_name: str, mime_type: str, storage_path: str) -> bool:
    normalized_file_name = source_file_name.lower()
    normalized_mime_type = mime_type.lower()
    normalized_storage_path = storage_path.lower()

    return (
        normalized_file_name.endswith(".csv")
        or "csv" in normalized_mime_type
        or normalized_storage_path.endswith(".csv")
    )


def normalize_key(*parts: object) -> tuple[str, str, str, str]:
    normalized_parts = [normalize_text(part).casefold() for part in parts]
    return (
        normalized_parts[0],
        normalized_parts[1],
        normalized_parts[2],
        normalized_parts[3],
    )


def should_emit_durable_candidate(row: dict[str, str]) -> tuple[bool, str]:
    section = normalize_text(row.get(CSV_FIELD_SECTION, "")).casefold()
    item_name = normalize_text(row.get(CSV_FIELD_ITEM_NAME, ""))
    item_name_key = item_name.casefold()

    if section == "appliances":
        return True, "appliance"

    if section != "plumbing fixtures":
        return False, ""

    durable_terms = (
        "toilet",
        "faucet",
        "shower",
        "tub faucet",
        "sink faucet",
        "water heater",
        "hot water tank",
    )

    if any(term in item_name_key for term in durable_terms):
        return True, "plumbing"

    return False, ""


def build_source_file_name(source_file_name: str, section: str, item_name: str) -> str:
    parts = [normalize_text(source_file_name), normalize_text(section), normalize_text(item_name)]
    return " :: ".join(part for part in parts if part)


def build_raw_ai_output(
    source_row: dict[str, object],
    csv_row: dict[str, str],
    csv_row_number: int,
) -> dict[str, object]:
    return {
        "source_intake_item_id": normalize_text(source_row.get("id")),
        "source_file_name": normalize_text(source_row.get("source_file_name")),
        "source_storage_path": normalize_text(source_row.get("storage_path")),
        "project_name": normalize_text(csv_row.get(CSV_FIELD_PROJECT_NAME, "")),
        "section": normalize_text(csv_row.get(CSV_FIELD_SECTION, "")),
        "csv_row_number": csv_row_number,
        "original_row": csv_row,
    }


def explode_csv_intake_item(source_intake_item_id: str) -> dict[str, object]:
    source_row = fetch_one_row(
        "intake_items",
        {
            "select": "*",
            "id": f"eq.{source_intake_item_id}",
            "limit": "1",
        },
    )

    if source_row is None:
        raise RuntimeError(f"Source intake item not found: {source_intake_item_id}")

    intake_run_id = normalize_text(source_row.get("intake_run_id"))
    source_file_name = normalize_text(source_row.get("source_file_name"))
    mime_type = normalize_text(source_row.get("mime_type"))
    storage_path = normalize_text(source_row.get("storage_path"))

    if not intake_run_id:
        raise RuntimeError("Source intake item is missing intake_run_id.")

    if not storage_path:
        raise RuntimeError("Source intake item is missing storage_path.")

    if not is_csv_like(source_file_name, mime_type, storage_path):
        raise RuntimeError("Source intake item is not a CSV-like evidence file.")

    existing_rows = fetch_rows(
        "intake_items",
        {
            "select": "id,title,brand,model_number,proposed_category",
            "intake_run_id": f"eq.{intake_run_id}",
            "limit": "5000",
        },
    )
    existing_keys = {
        normalize_key(
            row.get("title"),
            row.get("brand"),
            row.get("model_number"),
            row.get("proposed_category"),
        )
        for row in existing_rows
    }

    csv_text = download_storage_text(storage_path)
    reader = csv.DictReader(csv_text.splitlines())
    parsed_rows = 0
    created_rows = 0
    skipped_rows = 0

    for csv_row_number, csv_row in enumerate(reader, start=2):
        parsed_rows += 1
        include_row, proposed_category = should_emit_durable_candidate(csv_row)
        if not include_row:
            skipped_rows += 1
            continue

        title = normalize_text(csv_row.get(CSV_FIELD_ITEM_NAME, ""))
        brand = normalize_text(csv_row.get(CSV_FIELD_BRAND, ""))
        model_number = normalize_text(csv_row.get(CSV_FIELD_MODEL, ""))
        section = normalize_text(csv_row.get(CSV_FIELD_SECTION, ""))

        if not title or not proposed_category:
            skipped_rows += 1
            continue

        dedupe_key = normalize_key(title, brand, model_number, proposed_category)
        if dedupe_key in existing_keys:
            skipped_rows += 1
            continue

        payload = {
            "intake_run_id": intake_run_id,
            "source_file_name": build_source_file_name(source_file_name, section, title),
            "item_kind": "other",
            "title": title,
            "brand": brand or None,
            "model_number": model_number or None,
            "proposed_category": proposed_category,
            "needs_review": True,
            "review_status": "unreviewed",
            "raw_ai_output": build_raw_ai_output(source_row, csv_row, csv_row_number),
            "review_notes": (
                f"Derived durable-product candidate from CSV intake item "
                f"{source_intake_item_id} (section: {section})."
            ),
        }
        insert_row("intake_items", payload)
        existing_keys.add(dedupe_key)
        created_rows += 1

    return {
        "source_intake_item_id": source_intake_item_id,
        "intake_run_id": intake_run_id,
        "rows_parsed": parsed_rows,
        "staged_durable_candidates_created": created_rows,
        "skipped_rows": skipped_rows,
    }


def main(argv: list[str]) -> int:
    load_env()

    if len(argv) != 2:
        print(
            "Usage: python3 scripts/explode_csv_intake_item_to_staged_rows.py <intake_item_id>",
            file=sys.stderr,
        )
        return 1

    source_intake_item_id = argv[1].strip()
    if not source_intake_item_id:
        print("intake_item_id is required.", file=sys.stderr)
        return 1

    summary = explode_csv_intake_item(source_intake_item_id)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
