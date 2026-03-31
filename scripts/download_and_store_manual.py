#!/usr/bin/env python3

import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT_MANUALS_BUCKET = "project-manuals"


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


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "manual"


def build_file_name(brand: str, model: str, source_file_name: str, source_path: str) -> str:
    parsed = urllib.parse.urlparse(source_path)
    remote_name = Path(parsed.path).name
    lower_remote_name = remote_name.lower()
    if lower_remote_name.endswith(".pdf"):
        return remote_name

    lower_source_name = source_file_name.lower()
    if lower_source_name.endswith(".pdf"):
        return source_file_name

    return f"{slugify(brand)}-{slugify(model)}-manual.pdf"


def download_remote_file(source_url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(source_url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
            mime_type = normalize_text(response.headers.get_content_type())
            return content, mime_type
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Remote download failed ({error.code}) for {source_url}: {error_body}"
        ) from error


def ensure_pdf_like(content: bytes, mime_type: str, source_url: str, source_file_name: str) -> str:
    pdf_signature = content.startswith(b"%PDF-")
    normalized_mime = mime_type.lower()
    url_lower = source_url.lower()
    file_name_lower = source_file_name.lower()

    if pdf_signature:
        return "application/pdf"

    if normalized_mime == "application/pdf":
        return normalized_mime

    if url_lower.endswith(".pdf") or file_name_lower.endswith(".pdf"):
        return "application/pdf"

    raise RuntimeError("Downloaded asset does not look like a PDF manual.")


def upload_to_project_manuals_storage(
    file_path: str,
    file_bytes: bytes,
    mime_type: str,
) -> None:
    base_url, service_role_key = get_supabase_config()
    url = (
        f"{base_url}/storage/v1/object/{PROJECT_MANUALS_BUCKET}/"
        f"{urllib.parse.quote(file_path, safe='/')}"
    )
    request = urllib.request.Request(
        url,
        data=file_bytes,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": mime_type,
            "x-upsert": "true",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request):
            return
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase storage upload failed ({error.code}) for {file_path}: {error_body}"
        ) from error


def download_and_store_manual(intake_item_id: str) -> dict[str, object]:
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

    source_path = normalize_text(intake_item.get("source_path"))
    proposed_document_type = normalize_text(intake_item.get("proposed_document_type"))
    product_instance_id = normalize_text(intake_item.get("proposed_product_instance_id"))
    if not source_path.startswith(("http://", "https://")):
        raise RuntimeError("Staged manual row is missing a valid source_path URL.")
    if proposed_document_type != "manual":
        raise RuntimeError("Staged manual row must have proposed_document_type = manual.")
    if not product_instance_id:
        raise RuntimeError("Staged manual row is missing proposed_product_instance_id.")

    existing_import_target_id = normalize_text(intake_item.get("import_target_id"))
    if normalize_text(intake_item.get("import_target_type")) == "project_manual" and existing_import_target_id:
        project_manual = fetch_one_row(
            "project_manuals",
            {
                "select": "*",
                "id": f"eq.{existing_import_target_id}",
                "limit": "1",
            },
        )
        return {
            "status": "already_imported",
            "intake_item_id": intake_item_id,
            "project_manual_id": existing_import_target_id,
            "file_path": normalize_text(project_manual.get("file_path")) if project_manual else "",
            "file_name": normalize_text(project_manual.get("file_name")) if project_manual else "",
        }

    duplicate_import = fetch_one_row(
        "intake_items",
        {
            "select": "*",
            "proposed_product_instance_id": f"eq.{product_instance_id}",
            "source_path": f"eq.{source_path}",
            "proposed_document_type": "eq.manual",
            "import_target_type": "eq.project_manual",
            "limit": "1",
        },
    )
    if duplicate_import is not None:
        duplicate_target_id = normalize_text(duplicate_import.get("import_target_id"))
        imported_at = datetime.now(timezone.utc).isoformat()
        update_row(
            "intake_items",
            intake_item_id,
            {
                "imported_at": imported_at,
                "import_target_type": "project_manual",
                "import_target_id": duplicate_target_id,
            },
        )
        project_manual = fetch_one_row(
            "project_manuals",
            {
                "select": "*",
                "id": f"eq.{duplicate_target_id}",
                "limit": "1",
            },
        )
        return {
            "status": "already_imported",
            "intake_item_id": intake_item_id,
            "project_manual_id": duplicate_target_id,
            "file_path": normalize_text(project_manual.get("file_path")) if project_manual else "",
            "file_name": normalize_text(project_manual.get("file_name")) if project_manual else "",
        }

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
    category = normalize_text(intake_item.get("proposed_category")) or normalize_text(product.get("category"))
    source_file_name = normalize_text(intake_item.get("source_file_name"))

    if not project_id or not brand or not model_number:
        raise RuntimeError("Manual import requires project_id, brand, and model_number.")

    file_bytes, downloaded_mime_type = download_remote_file(source_path)
    mime_type = ensure_pdf_like(file_bytes, downloaded_mime_type, source_path, source_file_name)
    file_name = build_file_name(brand, model_number, source_file_name, source_path)
    file_path = f"{project_id}/manuals/{file_name}"

    upload_to_project_manuals_storage(file_path, file_bytes, mime_type)

    existing_project_manual = fetch_one_row(
        "project_manuals",
        {
            "select": "*",
            "product_instance_id": f"eq.{product_instance_id}",
            "file_name": f"eq.{file_name}",
            "doc_type": "eq.manual",
            "limit": "1",
        },
    )

    if existing_project_manual is None:
        project_manual = insert_row(
            "project_manuals",
            {
                "project_id": project_id,
                "category": category or "general",
                "file_path": file_path,
                "file_name": file_name,
                "file_size_bytes": len(file_bytes),
                "mime_type": mime_type,
                "product_instance_id": product_instance_id,
                "doc_type": "manual",
            },
        )
        status = "created"
    else:
        project_manual = update_row(
            "project_manuals",
            normalize_text(existing_project_manual.get("id")),
            {
                "file_path": file_path,
                "file_name": file_name,
                "file_size_bytes": len(file_bytes),
                "mime_type": mime_type,
                "product_instance_id": product_instance_id,
                "category": category or normalize_text(existing_project_manual.get("category")) or "general",
                "doc_type": "manual",
            },
        )
        status = "updated"

    imported_at = datetime.now(timezone.utc).isoformat()
    update_row(
        "intake_items",
        intake_item_id,
        {
            "mime_type": mime_type,
            "file_size_bytes": len(file_bytes),
            "storage_path": f"{PROJECT_MANUALS_BUCKET}/{file_path}",
            "imported_at": imported_at,
            "import_target_type": "project_manual",
            "import_target_id": normalize_text(project_manual.get("id")),
        },
    )

    return {
        "status": status,
        "intake_item_id": intake_item_id,
        "project_manual_id": normalize_text(project_manual.get("id")),
        "file_path": normalize_text(project_manual.get("file_path")),
        "file_name": normalize_text(project_manual.get("file_name")),
        "mime_type": normalize_text(project_manual.get("mime_type")),
        "file_size_bytes": int(project_manual.get("file_size_bytes") or 0),
    }


def main(argv: list[str]) -> int:
    load_env()

    if len(argv) != 2:
        print(
            "Usage: python3 scripts/download_and_store_manual.py <intake_item_id>",
            file=sys.stderr,
        )
        return 1

    intake_item_id = argv[1].strip()
    if not intake_item_id:
        print("intake_item_id is required.", file=sys.stderr)
        return 1

    summary = download_and_store_manual(intake_item_id)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
