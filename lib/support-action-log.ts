import { google } from 'googleapis';

type SupportActionLogEntry = {
  loggedAt: string;
  ticketId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  actionType: string;
  actionStatus: string;
  resolutionStatus: string;
  resolvedAccountId: string;
  resolvedPropertyId: string;
  resolvedBinderId: string;
  needsHumanReview: boolean;
  summaryOrNote: string;
  operatorSource: string;
};

const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SUPPORT_ACTION_LOG_SHEET_NAME = 'SupportActionLog';
const SUPPORT_ACTION_LOG_HEADERS = [
  'logged_at',
  'ticket_id',
  'customer_name',
  'customer_email',
  'subject',
  'action_type',
  'action_status',
  'resolution_status',
  'resolved_account_id',
  'resolved_property_id',
  'resolved_binder_id',
  'needs_human_review',
  'summary_or_note',
  'operator_source'
] as const;

function getRequiredEnvVar(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSheetsConfig() {
  return {
    spreadsheetId: getRequiredEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID'),
    credentialsPath:
      process.env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      undefined,
    credentialsJson: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() || undefined,
    sheetName:
      process.env.SUPPORT_ACTION_LOG_SHEET_NAME?.trim() || SUPPORT_ACTION_LOG_SHEET_NAME
  };
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

async function ensureSupportActionLogSheet() {
  const { config, sheets } = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId
  });
  const existingSheet = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties?.title === config.sheetName
  );

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: config.sheetName
              }
            }
          }
        ]
      }
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A1:N1`,
    majorDimension: 'ROWS'
  });
  const currentHeader = (headerResponse.data.values?.[0] || []).map((value) => `${value}`);

  if (currentHeader.join('|') !== SUPPORT_ACTION_LOG_HEADERS.join('|')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [Array.from(SUPPORT_ACTION_LOG_HEADERS)]
      }
    });
  }

  return { config, sheets };
}

function truncateSummary(value: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length <= 500) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 497)}...`;
}

function entryToRow(entry: SupportActionLogEntry) {
  return [
    entry.loggedAt,
    entry.ticketId,
    entry.customerName,
    entry.customerEmail,
    entry.subject,
    entry.actionType,
    entry.actionStatus,
    entry.resolutionStatus,
    entry.resolvedAccountId,
    entry.resolvedPropertyId,
    entry.resolvedBinderId,
    entry.needsHumanReview ? 'true' : 'false',
    truncateSummary(entry.summaryOrNote),
    entry.operatorSource
  ];
}

export async function appendSupportActionLog(entry: SupportActionLogEntry) {
  const { config, sheets } = await ensureSupportActionLogSheet();

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A:N`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [entryToRow(entry)]
    }
  });
}
