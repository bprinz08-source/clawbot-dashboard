export const CANONICAL_BUILDER_COLUMNS = [
  'lead_id',
  'company_name',
  'website',
  'city',
  'state',
  'builder_type',
  'contact_name',
  'contact_title',
  'phone',
  'email',
  'linkedin_url',
  'source',
  'source_url',
  'tier',
  'priority',
  'status',
  'last_contact_date',
  'next_action',
  'next_action_due',
  'owner',
  'call_talk_track',
  'followup_email_draft',
  'linkedin_connect_draft',
  'recommended_contact_name',
  'recommended_contact_title',
  'recommended_contact_url',
  'recommended_contact_linkedin_url',
  'recommended_contact_confidence',
  'recommended_contact_summary',
  'call_path_hint',
  'notes',
  'enrichment_status',
  'created_at',
  'updated_at'
] as const;

export type BuilderColumn = (typeof CANONICAL_BUILDER_COLUMNS)[number];
export type BuilderRecord = Record<BuilderColumn, string>;
export type BuilderPatch = Partial<Record<BuilderColumn, string>>;

export const BUILDER_DETAIL_COLUMNS = [
  'company_name',
  'website',
  'city',
  'state',
  'builder_type',
  'contact_name',
  'contact_title',
  'phone',
  'email',
  'linkedin_url',
  'source',
  'source_url',
  'tier',
  'priority',
  'status',
  'last_contact_date',
  'next_action',
  'next_action_due',
  'owner',
  'call_talk_track',
  'followup_email_draft',
  'linkedin_connect_draft',
  'recommended_contact_name',
  'recommended_contact_title',
  'recommended_contact_url',
  'recommended_contact_linkedin_url',
  'recommended_contact_confidence',
  'recommended_contact_summary',
  'call_path_hint',
  'notes',
  'enrichment_status',
  'created_at',
  'updated_at'
] as const satisfies readonly BuilderColumn[];

export const MUTABLE_BUILDER_COLUMNS = [
  'company_name',
  'website',
  'city',
  'state',
  'builder_type',
  'contact_name',
  'contact_title',
  'phone',
  'email',
  'linkedin_url',
  'source',
  'source_url',
  'tier',
  'priority',
  'status',
  'last_contact_date',
  'next_action',
  'next_action_due',
  'owner',
  'call_talk_track',
  'followup_email_draft',
  'linkedin_connect_draft',
  'recommended_contact_name',
  'recommended_contact_title',
  'recommended_contact_url',
  'recommended_contact_linkedin_url',
  'recommended_contact_confidence',
  'recommended_contact_summary',
  'call_path_hint',
  'notes',
  'enrichment_status'
] as const satisfies readonly BuilderColumn[];

export const LEGACY_COLUMN_ALIASES: Record<BuilderColumn, string[]> = {
  lead_id: ['lead_id', 'id', 'builder_id'],
  company_name: ['company_name', 'company', 'builder_name', 'name'],
  website: ['website', 'domain', 'company_website', 'url'],
  city: ['city', 'market', 'location_city'],
  state: ['state', 'region', 'location_state'],
  builder_type: ['builder_type', 'type', 'segment', 'specialties'],
  contact_name: ['contact_name', 'primary_contact', 'contact'],
  contact_title: ['contact_title', 'title', 'job_title'],
  phone: ['phone', 'phone_number'],
  email: ['email', 'email_address'],
  linkedin_url: ['linkedin_url', 'linkedin', 'linkedin_profile'],
  source: ['source', 'lead_source'],
  source_url: ['source_url', 'source_link'],
  tier: ['tier', 'rank_tier'],
  priority: ['priority'],
  status: ['status', 'crm_status'],
  last_contact_date: ['last_contact_date', 'last_contacted_at'],
  next_action: ['next_action'],
  next_action_due: ['next_action_due', 'next_follow_up_date', 'next_followup_at'],
  owner: ['owner', 'assigned_to'],
  call_talk_track: ['call_talk_track', 'talk_track'],
  followup_email_draft: ['followup_email_draft', 'follow_up_email_draft', 'email_draft'],
  linkedin_connect_draft: ['linkedin_connect_draft', 'linkedin_message_draft'],
  recommended_contact_name: ['recommended_contact_name', 'best_contact_name'],
  recommended_contact_title: ['recommended_contact_title', 'best_contact_title'],
  recommended_contact_url: ['recommended_contact_url', 'best_contact_url'],
  recommended_contact_linkedin_url: [
    'recommended_contact_linkedin_url',
    'best_contact_linkedin_url'
  ],
  recommended_contact_confidence: [
    'recommended_contact_confidence',
    'best_contact_confidence'
  ],
  recommended_contact_summary: ['recommended_contact_summary', 'best_contact_summary'],
  call_path_hint: ['call_path_hint'],
  notes: ['notes', 'builder_notes'],
  enrichment_status: ['enrichment_status'],
  created_at: ['created_at'],
  updated_at: ['updated_at']
};

function normalizeColumnName(value: string) {
  return value.trim().toLowerCase();
}

function buildAliasLookup() {
  const lookup = new Map<string, BuilderColumn>();

  for (const column of CANONICAL_BUILDER_COLUMNS) {
    for (const alias of LEGACY_COLUMN_ALIASES[column]) {
      lookup.set(normalizeColumnName(alias), column);
    }
  }

  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

export function canonicalizeColumnName(value: string) {
  return ALIAS_LOOKUP.get(normalizeColumnName(value)) ?? null;
}

export function createEmptyBuilderRecord(): BuilderRecord {
  return Object.fromEntries(
    CANONICAL_BUILDER_COLUMNS.map((column) => [column, ''])
  ) as BuilderRecord;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveLeadId(record: BuilderRecord, rowIndex: number) {
  const preferredId = slugify(record.website) || slugify(record.company_name);

  if (preferredId) {
    return preferredId;
  }

  return `builder-${rowIndex + 1}`;
}

export function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function computePriorityFromTier(tier: string) {
  if (tier === 'Tier 1') {
    return 'High';
  }

  if (tier === 'Tier 2') {
    return 'Medium';
  }

  if (tier === 'Tier 3') {
    return 'Low';
  }

  return '';
}

export function parseBasicCsv(csv: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      currentCell = '';

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
  }

  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function normalizeBuilderRecord(record: BuilderRecord, rowIndex = 0) {
  const normalizedRecord = createEmptyBuilderRecord();

  for (const column of CANONICAL_BUILDER_COLUMNS) {
    normalizedRecord[column] = `${record[column] ?? ''}`.trim();
  }

  if (!normalizedRecord.lead_id) {
    normalizedRecord.lead_id = deriveLeadId(normalizedRecord, rowIndex);
  }

  if (!normalizedRecord.priority) {
    normalizedRecord.priority = computePriorityFromTier(normalizedRecord.tier);
  }

  if (!normalizedRecord.created_at) {
    normalizedRecord.created_at = normalizedRecord.updated_at || getCurrentTimestamp();
  }

  if (!normalizedRecord.updated_at) {
    normalizedRecord.updated_at = normalizedRecord.created_at;
  }

  return normalizedRecord;
}

export function normalizeBuilderRows(rows: string[][]) {
  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0] ?? [];
  const columnIndexByCanonicalName = new Map<BuilderColumn, number>();

  headerRow.forEach((header, index) => {
    const canonicalName = canonicalizeColumnName(header);

    if (canonicalName && !columnIndexByCanonicalName.has(canonicalName)) {
      columnIndexByCanonicalName.set(canonicalName, index);
    }
  });

  return rows.slice(1).map((row, rowIndex) => {
    const record = createEmptyBuilderRecord();

    for (const column of CANONICAL_BUILDER_COLUMNS) {
      const rowIndex = columnIndexByCanonicalName.get(column);

      if (rowIndex !== undefined) {
        record[column] = row[rowIndex] ?? '';
      }
    }

    return normalizeBuilderRecord(record, rowIndex);
  });
}

export function normalizeBuilderPatch(input: Record<string, unknown>) {
  const patch: BuilderPatch = {};

  for (const column of MUTABLE_BUILDER_COLUMNS) {
    const directValue = input[column];

    if (typeof directValue === 'string') {
      patch[column] = directValue.trim();
      continue;
    }

    for (const alias of LEGACY_COLUMN_ALIASES[column]) {
      const aliasedValue = input[alias];

      if (typeof aliasedValue === 'string') {
        patch[column] = aliasedValue.trim();
        break;
      }
    }
  }

  return patch;
}

export function applyBuilderPatch(record: BuilderRecord, patch: BuilderPatch) {
  const nextRecord = createEmptyBuilderRecord();

  for (const column of CANONICAL_BUILDER_COLUMNS) {
    nextRecord[column] = record[column] ?? '';
  }

  for (const column of MUTABLE_BUILDER_COLUMNS) {
    const nextValue = patch[column];

    if (typeof nextValue === 'string') {
      nextRecord[column] = nextValue;
    }
  }

  nextRecord.updated_at = getCurrentTimestamp();

  return normalizeBuilderRecord(nextRecord);
}

export function mergeBuilderRecords(existingRecord: BuilderRecord, incomingRecord: BuilderRecord) {
  const mergedRecord = createEmptyBuilderRecord();

  for (const column of CANONICAL_BUILDER_COLUMNS) {
    const incomingValue = `${incomingRecord[column] ?? ''}`.trim();
    const existingValue = `${existingRecord[column] ?? ''}`.trim();

    mergedRecord[column] = incomingValue || existingValue;
  }

  mergedRecord.lead_id = existingRecord.lead_id || incomingRecord.lead_id;
  mergedRecord.created_at = existingRecord.created_at || incomingRecord.created_at;
  mergedRecord.updated_at = getCurrentTimestamp();

  return normalizeBuilderRecord(mergedRecord);
}

export function builderRecordToRow(record: BuilderRecord) {
  return CANONICAL_BUILDER_COLUMNS.map((column) => record[column] ?? '');
}

function escapeCsvCell(value: string) {
  const escapedValue = value.replace(/"/g, '""');

  if (/[",\n\r]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

export function serializeBuilderRows(records: BuilderRecord[]) {
  const header = CANONICAL_BUILDER_COLUMNS.join(',');
  const rows = records.map((record) =>
    CANONICAL_BUILDER_COLUMNS.map((column) => escapeCsvCell(record[column] ?? '')).join(',')
  );

  return [header, ...rows].join('\n');
}
