#!/usr/bin/env python3

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE_TYPE = "manual_operator_import"
DOCUMENT_TYPE = "manual"
REVIEW_NOTE = "Human-selected sourced manual evidence link; file not downloaded yet."


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


def normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "manual"


def build_source_label(brand: str, model: str) -> str:
    return f"manual-source:{slugify(brand)}-{slugify(model)}"


def stage_selected_manual_link(
    intake_item_id: str,
    candidate_url: str,
    candidate_title: str,
    source_label: str,
    query: str,
) -> dict[str, object]:
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

    product_instance_id = normalize_text(intake_item.get("import_target_id"))
    if normalize_text(intake_item.get("import_target_type")) != "product_instance" or not product_instance_id:
        raise RuntimeError("Intake item is not linked to a live product_instance.")

    product = fetch_one_row(
        "product_instances",
        {
            "select": "*",
            "id": f"eq.{product_instance_id}",
            "limit": "1",
        },
    )
    if product is None:
        raise RuntimeError(f"Linked product_instance not found: {product_instance_id}")

    project_id = normalize_text(product.get("project_id"))
    brand = normalize_text(intake_item.get("brand")) or normalize_text(product.get("brand"))
    model_number = normalize_text(intake_item.get("model_number")) or normalize_text(product.get("model"))
    proposed_category = normalize_text(intake_item.get("proposed_category")) or normalize_text(product.get("category"))
    if not project_id or not brand or not model_number or not proposed_category:
        raise RuntimeError("Manual staging requires project, brand, model, and category.")

    existing_item = fetch_one_row(
        "intake_items",
        {
            "select": "*",
            "proposed_product_instance_id": f"eq.{product_instance_id}",
            "source_path": f"eq.{candidate_url}",
            "proposed_document_type": f"eq.{DOCUMENT_TYPE}",
            "limit": "1",
        },
    )

    if existing_item is not None:
        return {
            "created": False,
            "intake_run_id": normalize_text(existing_item.get("intake_run_id")),
            "intake_item_id": normalize_text(existing_item.get("id")),
            "source_path": normalize_text(existing_item.get("source_path")),
            "source_file_name": normalize_text(existing_item.get("source_file_name")),
            "proposed_product_instance_id": product_instance_id,
        }

    new_run = insert_row(
        "intake_runs",
        {
            "project_id": project_id,
            "source_type": SOURCE_TYPE,
            "source_label": build_source_label(brand, model_number),
            "status": "pending",
        },
    )

    staged_item = insert_row(
        "intake_items",
        {
            "intake_run_id": normalize_text(new_run.get("id")),
            "source_file_name": candidate_title,
            "item_kind": "other",
            "title": candidate_title,
            "brand": brand,
            "model_number": model_number,
            "proposed_category": proposed_category,
            "proposed_document_type": DOCUMENT_TYPE,
            "proposed_product_instance_id": product_instance_id,
            "needs_review": True,
            "review_status": "unreviewed",
            "source_path": candidate_url,
            "review_notes": REVIEW_NOTE,
            "raw_ai_output": {
                "label": candidate_title,
                "query": query,
                "source_label": source_label,
                "source_type": "human_selected_candidate",
                "sourced_url": candidate_url,
                "source_product": {
                    "title": normalize_text(intake_item.get("title")),
                    "brand": brand,
                    "model": model_number,
                    "category": proposed_category,
                    "project_id": project_id,
                    "product_instance_id": product_instance_id,
                    "source_intake_item_id": intake_item_id,
                },
            },
        },
    )

    return {
        "created": True,
        "intake_run_id": normalize_text(new_run.get("id")),
        "intake_item_id": normalize_text(staged_item.get("id")),
        "source_path": candidate_url,
        "source_file_name": candidate_title,
        "proposed_product_instance_id": product_instance_id,
    }


def main(argv: list[str]) -> int:
    load_env()

    if len(argv) != 6:
        print(
            "Usage: python3 scripts/stage_selected_manual_link.py <intake_item_id> <candidate_url> <candidate_title> <source_label> <query>",
            file=sys.stderr,
        )
        return 1

    summary = stage_selected_manual_link(
        argv[1].strip(),
        argv[2].strip(),
        argv[3].strip(),
        argv[4].strip(),
        argv[5].strip(),
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
