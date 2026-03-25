import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const CLAWBOT_GMAIL_SENDER = 'clawbot@asbuilt.dev' as const;
const GMAIL_SEND_SCOPE = ['https://www.googleapis.com/auth/gmail.send'];

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type ClawbotGmailConfig = {
  senderUser: typeof CLAWBOT_GMAIL_SENDER;
  credentialsPath?: string;
  credentialsJson?: string;
};

export type ClawbotTestEmailInput = {
  to: string;
  subject: string;
  body: string;
};

function decodePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n');
}

function getClawbotGmailConfig(): ClawbotGmailConfig {
  return {
    senderUser: CLAWBOT_GMAIL_SENDER,
    credentialsPath:
      process.env.GOOGLE_GMAIL_CREDENTIALS_PATH?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
      undefined,
    credentialsJson:
      process.env.GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() ||
      undefined
  };
}

async function loadServiceAccountCredentials(config: ClawbotGmailConfig) {
  if (config.credentialsJson) {
    const credentials = JSON.parse(config.credentialsJson) as ServiceAccountCredentials;

    return {
      client_email: credentials.client_email,
      private_key: decodePrivateKey(credentials.private_key)
    };
  }

  if (config.credentialsPath) {
    const fileContents = await readFile(config.credentialsPath, 'utf8');
    const credentials = JSON.parse(fileContents) as ServiceAccountCredentials;

    return {
      client_email: credentials.client_email,
      private_key: decodePrivateKey(credentials.private_key)
    };
  }

  throw new Error(
    'Missing Google service account credentials for Clawbot Gmail send.'
  );
}

async function createClawbotGmailClient() {
  const config = getClawbotGmailConfig();
  const credentials = await loadServiceAccountCredentials(config);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: GMAIL_SEND_SCOPE,
    subject: config.senderUser
  });

  await auth.authorize();

  return {
    config,
    gmail: google.gmail({
      version: 'v1',
      auth
    })
  };
}

let gmailClientPromise:
  | Promise<Awaited<ReturnType<typeof createClawbotGmailClient>>>
  | null = null;

async function getClawbotGmailClient() {
  if (!gmailClientPromise) {
    gmailClientPromise = createClawbotGmailClient();
  }

  return gmailClientPromise;
}

function normalizeHeaderValue(value: string) {
  return value.replace(/\r?\n/g, ' ').trim();
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildRawMessage(input: ClawbotTestEmailInput) {
  const subject = normalizeHeaderValue(input.subject);
  const to = normalizeHeaderValue(input.to);

  return toBase64Url(
    [
      `From: Clawbot <${CLAWBOT_GMAIL_SENDER}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      input.body
    ].join('\r\n')
  );
}

export async function sendClawbotTestEmail(input: ClawbotTestEmailInput) {
  const { gmail, config } = await getClawbotGmailClient();
  const response = await gmail.users.messages.send({
    userId: config.senderUser,
    requestBody: {
      raw: buildRawMessage(input)
    }
  });

  return {
    sender: config.senderUser,
    id: response.data.id || '',
    threadId: response.data.threadId || '',
    labelIds: response.data.labelIds || []
  };
}

export function getClawbotGmailSender() {
  return CLAWBOT_GMAIL_SENDER;
}
