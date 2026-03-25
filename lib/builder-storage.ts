import { promises as fs } from 'fs';
import { google } from 'googleapis';
import {
  applyBuilderPatch,
  BuilderPatch,
  BuilderRecord,
  builderRecordToRow,
  CANONICAL_BUILDER_COLUMNS,
  mergeBuilderRecords,
  normalizeBuilderPatch,
  normalizeBuilderRecord,
  normalizeBuilderRows,
  parseBasicCsv
} from '@/lib/builder-schema';

export interface BuilderStorage {
  readAll(): Promise<BuilderRecord[]>;
  findByLeadId(leadId: string): Promise<BuilderRecord | null>;
  patchByLeadId(leadId: string, input: Record<string, unknown>): Promise<BuilderRecord | null>;
  upsertMany(records: BuilderRecord[]): Promise<BuilderRecord[]>;
}

type SheetsConfig = {
  spreadsheetId: string;
  sheetName: string;
  credentialsPath?: string;
  credentialsJson?: string;
};

const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DISCOVERY_OUTPUT_FILE = '/home/gtm-employee/clawbot_workspace/builders_ranked.csv';

function getRequiredEnvVar(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSheetsConfig(): SheetsConfig {
  return {
    spreadsheetId: getRequiredEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID'),
    sheetName: getRequiredEnvVar('GOOGLE_SHEETS_SHEET_NAME'),
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
  const config = getSheetsConfig();
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

async function readSheetRows() {
  const { config, sheets } = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A:ZZ`,
    majorDimension: 'ROWS'
  });

  return (response.data.values ?? []).map((row) => row.map((cell) => `${cell ?? ''}`));
}

async function writeSheetRows(records: BuilderRecord[]) {
  const { config, sheets } = await getSheetsClient();
  const values = [
    [...CANONICAL_BUILDER_COLUMNS],
    ...records.map((record) => builderRecordToRow(record))
  ];
  const lastColumn = toA1Column(CANONICAL_BUILDER_COLUMNS.length);
  const clearRange = `${config.sheetName}!A:${lastColumn}`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range: clearRange
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

class GoogleSheetsBuilderStorage implements BuilderStorage {
  async readAll() {
    const rows = await readSheetRows();

    if (rows.length === 0) {
      return [];
    }

    return normalizeBuilderRows(rows);
  }

  async findByLeadId(leadId: string) {
    const records = await this.readAll();
    return records.find((record) => record.lead_id === leadId) ?? null;
  }

  async patchByLeadId(leadId: string, input: Record<string, unknown>) {
    const records = await this.readAll();
    const patch: BuilderPatch = normalizeBuilderPatch(input);
    const recordIndex = records.findIndex((record) => record.lead_id === leadId);

    if (recordIndex === -1) {
      return null;
    }

    records[recordIndex] = applyBuilderPatch(records[recordIndex], patch);
    await writeSheetRows(records);

    return records[recordIndex];
  }

  async upsertMany(records: BuilderRecord[]) {
    const existingRecords = await this.readAll();
    const existingRecordByLeadId = new Map(
      existingRecords.map((record) => [record.lead_id, record])
    );

    for (const record of records.map((entry, index) => normalizeBuilderRecord(entry, index))) {
      const existingRecord = existingRecordByLeadId.get(record.lead_id);

      if (existingRecord) {
        existingRecordByLeadId.set(
          record.lead_id,
          mergeBuilderRecords(existingRecord, record)
        );
      } else {
        existingRecordByLeadId.set(record.lead_id, record);
      }
    }

    const nextRecords = Array.from(existingRecordByLeadId.values());
    await writeSheetRows(nextRecords);

    return nextRecords;
  }
}

const builderStorage: BuilderStorage = new GoogleSheetsBuilderStorage();

export const BUILDER_STORAGE_TARGET = (() => {
  try {
    const config = getSheetsConfig();
    return `google-sheets:${config.spreadsheetId}/${config.sheetName}`;
  } catch {
    return 'google-sheets:unconfigured';
  }
})();

export async function readBuilderRecords() {
  return builderStorage.readAll();
}

export async function findBuilderRecordByLeadId(leadId: string) {
  return builderStorage.findByLeadId(leadId);
}

export async function updateBuilderRecord(leadId: string, input: Record<string, unknown>) {
  return builderStorage.patchByLeadId(leadId, input);
}

export async function upsertBuilderRecords(records: BuilderRecord[]) {
  return builderStorage.upsertMany(records);
}

export async function loadBuilderRecordsFromDiscoveryOutput() {
  const file = await fs.readFile(DISCOVERY_OUTPUT_FILE, 'utf-8');
  return normalizeBuilderRows(parseBasicCsv(file));
}

export async function importDiscoveryOutputToStorage() {
  const records = await loadBuilderRecordsFromDiscoveryOutput();

  if (records.length === 0) {
    return [];
  }

  return upsertBuilderRecords(records);
}

export function getBuilderStorageTarget() {
  return BUILDER_STORAGE_TARGET;
}

export function getBuilderStorageConfig() {
  const config = getSheetsConfig();

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

export function formatBuilderStorageError(error: unknown) {
  return getErrorMessage(error);
}
