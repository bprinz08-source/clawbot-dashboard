import { google } from 'googleapis';
import {
  JOB_HUNT_LANES,
  JOB_HUNT_STATUSES,
  type JobHuntLane,
  type JobHuntRole,
  type JobHuntStatus
} from '@/lib/job-hunt-shared';

type SheetsConfig = {
  spreadsheetId: string;
  sheetName: string;
  credentialsPath?: string;
  credentialsJson?: string;
};

const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export const JOB_HUNT_SHEET_COLUMNS = [
  'opportunity_id',
  'company_name',
  'role_title',
  'role_lane',
  'location',
  'work_model',
  'compensation_estimate',
  'source',
  'posting_url',
  'date_found',
  'status',
  'fit_score',
  'story_match_score',
  'urgency_score',
  'why_this_role',
  'why_brandon_wins_here',
  'narrative_angle',
  'resume_version',
  'follow_up_date',
  'notes',
  'created_at',
  'updated_at'
] as const;

function getRequiredEnvVar(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getJobHuntSheetsConfig(): SheetsConfig {
  return {
    spreadsheetId:
      process.env.JOB_HUNT_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
      getRequiredEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID'),
    sheetName: process.env.JOB_HUNT_GOOGLE_SHEETS_SHEET_NAME?.trim() || 'opportunities',
    credentialsPath:
      process.env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      undefined,
    credentialsJson:
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() ||
      undefined
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function toA1Column(columnNumber: number) {
  let currentColumnNumber = columnNumber;
  let columnName = '';

  while (currentColumnNumber > 0) {
    const remainder = (currentColumnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    currentColumnNumber = Math.floor((currentColumnNumber - 1) / 26);
  }

  return columnName;
}

async function createSheetsClient() {
  const config = getJobHuntSheetsConfig();
  const authOptions: ConstructorParameters<typeof google.auth.GoogleAuth>[0] = {
    scopes: GOOGLE_SHEETS_SCOPES
  };

  if (config.credentialsJson) {
    const credentials = JSON.parse(config.credentialsJson) as {
      client_email: string;
      private_key: string;
    };
    authOptions.credentials = {
      ...credentials,
      private_key: credentials.private_key?.replace(/\\n/g, '\n') ?? ''
    };
  } else if (config.credentialsPath) {
    authOptions.keyFile = config.credentialsPath;
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  await auth.getClient();

  return {
    config,
    sheets: google.sheets({
      version: 'v4',
      auth
    })
  };
}

let sheetsClientPromise: Promise<Awaited<ReturnType<typeof createSheetsClient>>> | null = null;

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = createSheetsClient();
  }

  return sheetsClientPromise;
}

function normalizeScore(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeLane(value: string): JobHuntLane {
  return (JOB_HUNT_LANES.find((lane) => lane === value) ||
    'Enterprise AE / Strategic AE') as JobHuntLane;
}

function normalizeStatus(value: string): JobHuntStatus {
  return (JOB_HUNT_STATUSES.find((status) => status === value) || 'New') as JobHuntStatus;
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeRole(input: Partial<JobHuntRole>): JobHuntRole {
  return {
    opportunity_id: normalizeText(input.opportunity_id || ''),
    lane: normalizeLane(input.lane || ''),
    company_name: normalizeText(input.company_name || ''),
    role_title: normalizeText(input.role_title || ''),
    location: normalizeText(input.location || ''),
    work_model: normalizeText(input.work_model || ''),
    compensation_estimate: normalizeText(input.compensation_estimate || ''),
    source: normalizeText(input.source || ''),
    posting_url: normalizeText(input.posting_url || ''),
    date_found: normalizeText(input.date_found || ''),
    status: normalizeStatus(input.status || ''),
    fit_score: normalizeScore(`${input.fit_score ?? ''}`),
    story_match_score: normalizeScore(`${input.story_match_score ?? ''}`),
    urgency_score: normalizeScore(`${input.urgency_score ?? ''}`),
    why_this_role: `${input.why_this_role || ''}`.trim(),
    why_brandon_wins_here: `${input.why_brandon_wins_here || ''}`.trim(),
    narrative_angle: `${input.narrative_angle || ''}`.trim(),
    resume_version: normalizeText(input.resume_version || ''),
    follow_up_date: normalizeText(input.follow_up_date || ''),
    notes: `${input.notes || ''}`.trim(),
    created_at: normalizeText(input.created_at || ''),
    updated_at: normalizeText(input.updated_at || '')
  };
}

function roleToSheetRow(role: JobHuntRole) {
  return [
    role.opportunity_id,
    role.company_name,
    role.role_title,
    role.lane,
    role.location,
    role.work_model,
    role.compensation_estimate,
    role.source,
    role.posting_url,
    role.date_found,
    role.status,
    `${role.fit_score}`,
    `${role.story_match_score}`,
    `${role.urgency_score}`,
    role.why_this_role,
    role.why_brandon_wins_here,
    role.narrative_angle,
    role.resume_version,
    role.follow_up_date,
    role.notes,
    role.created_at,
    role.updated_at
  ];
}

function parseSheetRows(rows: string[][]): JobHuntRole[] {
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndex = new Map(headerRow.map((value, index) => [value.trim(), index]));

  return dataRows
    .filter((row) => row.some((cell) => `${cell ?? ''}`.trim() !== ''))
    .map((row) => {
      const getValue = (columnName: (typeof JOB_HUNT_SHEET_COLUMNS)[number]) =>
        `${row[headerIndex.get(columnName) ?? -1] ?? ''}`;

      return normalizeRole({
        opportunity_id: getValue('opportunity_id'),
        company_name: getValue('company_name'),
        role_title: getValue('role_title'),
        lane: getValue('role_lane') as JobHuntLane,
        location: getValue('location'),
        work_model: getValue('work_model'),
        compensation_estimate: getValue('compensation_estimate'),
        source: getValue('source'),
        posting_url: getValue('posting_url'),
        date_found: getValue('date_found'),
        status: getValue('status') as JobHuntStatus,
        fit_score: normalizeScore(getValue('fit_score')),
        story_match_score: normalizeScore(getValue('story_match_score')),
        urgency_score: normalizeScore(getValue('urgency_score')),
        why_this_role: getValue('why_this_role'),
        why_brandon_wins_here: getValue('why_brandon_wins_here'),
        narrative_angle: getValue('narrative_angle'),
        resume_version: getValue('resume_version'),
        follow_up_date: getValue('follow_up_date'),
        notes: getValue('notes'),
        created_at: getValue('created_at'),
        updated_at: getValue('updated_at')
      });
    })
    .filter((role) => role.opportunity_id !== '');
}

async function readSheetRows() {
  const { config, sheets } = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A:ZZ`,
    majorDimension: 'ROWS'
  });

  return (response.data.values ?? []).map((row) => row.map((cell) => `${cell ?? ''}`));
}

async function writeSheetRows(roles: JobHuntRole[]) {
  const { config, sheets } = await getSheetsClient();
  const values = [
    [...JOB_HUNT_SHEET_COLUMNS],
    ...roles.map((role) => roleToSheetRow(role))
  ];
  const lastColumn = toA1Column(JOB_HUNT_SHEET_COLUMNS.length);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A:${lastColumn}`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      majorDimension: 'ROWS',
      values
    }
  });
}

export async function readJobHuntRoles() {
  const rows = await readSheetRows();

  if (rows.length === 0) {
    return [];
  }

  return parseSheetRows(rows);
}

export async function findJobHuntRoleByOpportunityId(opportunityId: string) {
  const roles = await readJobHuntRoles();
  return roles.find((role) => role.opportunity_id === opportunityId) ?? null;
}

export async function upsertJobHuntRole(input: Partial<JobHuntRole>) {
  const opportunityId = normalizeText(input.opportunity_id || '');

  if (!opportunityId) {
    throw new Error('Missing required field: opportunity_id');
  }

  const roles = await readJobHuntRoles();
  const nowIso = new Date().toISOString();
  const existingIndex = roles.findIndex((role) => role.opportunity_id === opportunityId);
  const existingRole = existingIndex === -1 ? null : roles[existingIndex];

  const nextRole = normalizeRole({
    ...existingRole,
    ...input,
    opportunity_id: opportunityId,
    created_at: existingRole?.created_at || normalizeText(input.created_at || '') || nowIso,
    updated_at: nowIso
  });

  if (existingIndex === -1) {
    roles.push(nextRole);
  } else {
    roles[existingIndex] = nextRole;
  }

  await writeSheetRows(roles);

  return nextRole;
}

export function getJobHuntStorageTarget() {
  try {
    const config = getJobHuntSheetsConfig();
    return `google-sheets:${config.spreadsheetId}/${config.sheetName}`;
  } catch {
    return 'google-sheets:unconfigured';
  }
}

export function getJobHuntStorageConfig() {
  const config = getJobHuntSheetsConfig();

  return {
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName,
    credentialsSource: config.credentialsJson
      ? 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'
      : config.credentialsPath
        ? 'file'
        : 'application-default-credentials'
  };
}

export function formatJobHuntStorageError(error: unknown) {
  return getErrorMessage(error);
}
