type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IntakeRunRecord = {
  id: string;
  source_label: string;
  builder_name: string;
  project_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type IntakeItemRecord = {
  id: string;
  intake_run_id: string;
  source_file_name: string;
  item_kind: string;
  proposed_document_type: string;
  proposed_category: string;
  proposed_room_id: string;
  room_match_confidence: number | null;
  title: string;
  brand: string;
  model_number: string;
  serial_number: string;
  review_status: string;
  original_file_hash: string;
  import_target_type: string;
  import_target_id: string;
  imported_at: string;
  raw_ai_output: JsonValue | null;
  created_at: string;
  [key: string]: unknown;
};

export type IntakeRunListEntry = {
  run: IntakeRunRecord;
  itemCount: number;
  importedItemCount: number;
  unresolvedItemCount: number;
};

export type IntakeRunDetail = {
  run: IntakeRunRecord | null;
  items: IntakeItemRecord[];
  error: string | null;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    '';

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

async function fetchSupabaseRows(
  table: string,
  query: Record<string, string>
): Promise<Array<Record<string, unknown>>> {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const url = new URL(`/rest/v1/${table}`, config.url);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase ${table} query failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(`Unexpected Supabase response for ${table}.`);
  }

  return payload.filter((row): row is Record<string, unknown> => Boolean(row));
}

function mapRunRecord(row: Record<string, unknown>): IntakeRunRecord {
  return {
    id: normalizeString(row.id),
    source_label: normalizeString(row.source_label),
    builder_name: normalizeString(row.builder_name),
    project_id: normalizeString(row.project_id),
    status: normalizeString(row.status),
    created_at: normalizeString(row.created_at),
    updated_at: normalizeString(row.updated_at),
    ...row
  };
}

function mapItemRecord(row: Record<string, unknown>): IntakeItemRecord {
  return {
    id: normalizeString(row.id),
    intake_run_id: normalizeString(row.intake_run_id),
    source_file_name: normalizeString(row.source_file_name),
    item_kind: normalizeString(row.item_kind),
    proposed_document_type: normalizeString(row.proposed_document_type),
    proposed_category: normalizeString(row.proposed_category),
    proposed_room_id: normalizeString(row.proposed_room_id),
    room_match_confidence: normalizeNullableNumber(row.room_match_confidence),
    title: normalizeString(row.title),
    brand: normalizeString(row.brand),
    model_number: normalizeString(row.model_number),
    serial_number: normalizeString(row.serial_number),
    review_status: normalizeString(row.review_status),
    original_file_hash: normalizeString(row.original_file_hash),
    import_target_type: normalizeString(row.import_target_type),
    import_target_id: normalizeString(row.import_target_id),
    imported_at: normalizeString(row.imported_at),
    raw_ai_output: (row.raw_ai_output as JsonValue | null | undefined) ?? null,
    created_at: normalizeString(row.created_at),
    ...row
  };
}

export function isImportedItem(item: Pick<IntakeItemRecord, 'imported_at' | 'import_target_id'>) {
  return Boolean(item.imported_at || item.import_target_id);
}

export async function getIntakeRuns(): Promise<{
  runs: IntakeRunListEntry[];
  error: string | null;
}> {
  try {
    const runRows = await fetchSupabaseRows('intake_runs', {
      select: '*',
      order: 'updated_at.desc',
      limit: '50'
    });
    const runs = runRows.map(mapRunRecord);

    if (runs.length === 0) {
      return { runs: [], error: null };
    }

    const runIds = runs.map((run) => run.id).filter(Boolean);
    const itemRows = await fetchSupabaseRows('intake_items', {
      select: 'id,intake_run_id,imported_at,import_target_id',
      intake_run_id: `in.(${runIds.join(',')})`,
      limit: '5000'
    });

    const itemsByRunId = new Map<
      string,
      Array<Pick<IntakeItemRecord, 'id' | 'intake_run_id' | 'imported_at' | 'import_target_id'>>
    >();

    for (const row of itemRows) {
      const intakeRunId = normalizeString(row.intake_run_id);
      const item = {
        id: normalizeString(row.id),
        intake_run_id: intakeRunId,
        imported_at: normalizeString(row.imported_at),
        import_target_id: normalizeString(row.import_target_id)
      };

      const existingItems = itemsByRunId.get(intakeRunId) || [];
      existingItems.push(item);
      itemsByRunId.set(intakeRunId, existingItems);
    }

    return {
      runs: runs.map((run) => {
        const items = itemsByRunId.get(run.id) || [];
        const importedItemCount = items.filter(isImportedItem).length;

        return {
          run,
          itemCount: items.length,
          importedItemCount,
          unresolvedItemCount: items.length - importedItemCount
        };
      }),
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load intake runs.';

    return {
      runs: [],
      error: message
    };
  }
}

export async function getIntakeRunDetail(runId: string): Promise<IntakeRunDetail> {
  try {
    const runRows = await fetchSupabaseRows('intake_runs', {
      select: '*',
      id: `eq.${runId}`,
      limit: '1'
    });
    const run = runRows[0] ? mapRunRecord(runRows[0]) : null;

    if (!run) {
      return {
        run: null,
        items: [],
        error: null
      };
    }

    const itemRows = await fetchSupabaseRows('intake_items', {
      select: '*',
      intake_run_id: `eq.${runId}`,
      order: 'created_at.desc',
      limit: '5000'
    });
    const items = itemRows
      .map(mapItemRecord)
      .sort((left, right) => {
        const importedDiff = Number(isImportedItem(right)) - Number(isImportedItem(left));

        if (importedDiff !== 0) {
          return importedDiff;
        }

        return left.source_file_name.localeCompare(right.source_file_name);
      });

    return {
      run,
      items,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load intake run.';

    return {
      run: null,
      items: [],
      error: message
    };
  }
}

export function formatDateTime(value: string) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatConfidence(value: number | null) {
  if (value === null) {
    return '—';
  }

  if (value >= 0 && value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${value}`;
}

export function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}
