#!/usr/bin/env python3

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
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


def supabase_request(
    method: str,
    path: str,
    *,
    query: dict[str, str] | None = None,
    body: dict[str, object] | None = None,
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
        headers["Content-Type"] = "application/json"
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
    payload = supabase_request("GET", f"/rest/v1/{table}", query=query)
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


def update_row(table: str, row_id: str, payload: dict[str, object]) -> dict[str, object]:
    response = supabase_request(
        "PATCH",
        f"/rest/v1/{table}",
        query={"id": f"eq.{row_id}", "select": "*"},
        body=payload,
    )

    if not isinstance(response, list) or not response or not isinstance(response[0], dict):
        raise RuntimeError(f"Unexpected Supabase update response for {table}.")

    return response[0]


def normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def normalize_key(*parts: object) -> tuple[str, str, str, str]:
    normalized_parts = [normalize_text(part).casefold() for part in parts]
    return (
        normalized_parts[0],
        normalized_parts[1],
        normalized_parts[2],
        normalized_parts[3],
    )


def is_safe_promotable_row(row: dict[str, object]) -> bool:
    if normalize_text(row.get("item_kind")) != "other":
        return False

    if normalize_text(row.get("review_status")) != "unreviewed":
        return False

    if normalize_text(row.get("import_target_id")) or normalize_text(row.get("imported_at")):
        return False

    if normalize_text(row.get("title")).casefold() == "master shower":
        return False

    required_fields = (
        "proposed_category",
        "brand",
        "model_number",
        "title",
    )
    return all(normalize_text(row.get(field)) for field in required_fields)


def promote_safe_products_for_run(intake_run_id: str) -> dict[str, object]:
    run = fetch_one_row(
        "intake_runs",
        {
            "select": "id,project_id",
            "id": f"eq.{intake_run_id}",
            "limit": "1",
        },
    )
    if run is None:
        raise RuntimeError(f"Intake run not found: {intake_run_id}")

    project_id = normalize_text(run.get("project_id"))
    if not project_id:
        raise RuntimeError("Intake run is missing project_id.")

    intake_items = fetch_rows(
        "intake_items",
        {
            "select": "*",
            "intake_run_id": f"eq.{intake_run_id}",
            "order": "created_at.asc",
            "limit": "5000",
        },
    )

    existing_products = fetch_rows(
        "product_instances",
        {
            "select": "*",
            "project_id": f"eq.{project_id}",
            "limit": "5000",
        },
    )
    product_by_key = {
        normalize_key(
            product.get("project_id"),
            product.get("category"),
            product.get("brand"),
            product.get("model"),
        ): product
        for product in existing_products
    }

    eligible_count = 0
    created_count = 0
    linked_existing_count = 0
    skipped_count = 0
    imported_count = 0
    imported_item_ids: list[str] = []

    imported_at = datetime.now(timezone.utc).isoformat()

    for row in intake_items:
        if not is_safe_promotable_row(row):
            skipped_count += 1
            continue

        eligible_count += 1

        category = normalize_text(row.get("proposed_category"))
        brand = normalize_text(row.get("brand"))
        model_number = normalize_text(row.get("model_number"))
        item_key = normalize_key(project_id, category, brand, model_number)
        product = product_by_key.get(item_key)

        if product is None:
            product = insert_row(
                "product_instances",
                {
                    "project_id": project_id,
                    "category": category,
                    "brand": brand,
                    "model": model_number,
                    "serial_number": normalize_text(row.get("serial_number")) or None,
                    "install_date": normalize_text(row.get("install_date")) or None,
                    "warranty_end": normalize_text(row.get("warranty_end")) or None,
                    "room_id": normalize_text(row.get("proposed_room_id")) or None,
                    "notes": normalize_text(row.get("review_notes")) or None,
                },
            )
            product_by_key[item_key] = product
            created_count += 1
        else:
            linked_existing_count += 1

        update_row(
            "intake_items",
            normalize_text(row.get("id")),
            {
                "imported_at": imported_at,
                "import_target_type": "product_instance",
                "import_target_id": normalize_text(product.get("id")),
            },
        )
        imported_count += 1
        imported_item_ids.append(normalize_text(row.get("id")))

    return {
        "intake_run_id": intake_run_id,
        "project_id": project_id,
        "eligible_staged_rows": eligible_count,
        "product_instances_created": created_count,
        "linked_to_existing_product_instances": linked_existing_count,
        "staged_rows_imported": imported_count,
        "skipped_rows": skipped_count,
        "imported_item_ids": imported_item_ids,
    }


def main(argv: list[str]) -> int:
    load_env()

    if len(argv) != 2:
        print(
            "Usage: python3 scripts/promote_safe_intake_run_products.py <intake_run_id>",
            file=sys.stderr,
        )
        return 1

    intake_run_id = argv[1].strip()
    if not intake_run_id:
        print("intake_run_id is required.", file=sys.stderr)
        return 1

    summary = promote_safe_products_for_run(intake_run_id)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
