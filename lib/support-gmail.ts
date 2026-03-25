import { readFile } from 'fs/promises';
import { google, gmail_v1 } from 'googleapis';

const GMAIL_READONLY_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const GMAIL_METADATA_HEADERS = ['From', 'To', 'Date', 'Subject'];

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type GmailSupportMessage = {
  id: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  sentAt: string;
  body: string;
  isInbound: boolean;
};

export type GmailSupportThread = {
  threadId: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  body: string;
  channel: 'email';
  lastUpdatedAt: string;
  messages: GmailSupportMessage[];
  transcript: string;
};

type GmailSupportConfig = {
  mailboxUser: string;
  supportLabelName: string;
  supportAlias: string;
  credentialsPath?: string;
  credentialsJson?: string;
  impersonatedUser?: string;
};

function getRequiredEnvVar(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getGmailSupportConfig(): GmailSupportConfig {
  return {
    mailboxUser: process.env.GMAIL_SUPPORT_INBOX_USER?.trim() || 'brandon@asbuilt.dev',
    supportLabelName: process.env.GMAIL_SUPPORT_LABEL?.trim() || 'Support',
    supportAlias: process.env.GMAIL_SUPPORT_ALIAS?.trim() || 'support@asbuilt.dev',
    credentialsPath:
      process.env.GOOGLE_GMAIL_CREDENTIALS_PATH?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
      undefined,
    credentialsJson:
      process.env.GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() ||
      undefined,
    impersonatedUser:
      process.env.GMAIL_SUPPORT_IMPERSONATED_USER?.trim() ||
      process.env.GOOGLE_WORKSPACE_IMPERSONATED_USER?.trim() ||
      undefined
  };
}

function decodePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n');
}

async function loadServiceAccountCredentials(config: GmailSupportConfig) {
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

  getRequiredEnvVar('GOOGLE_APPLICATION_CREDENTIALS');

  return null;
}

async function createGmailClient() {
  const config = getGmailSupportConfig();
  let auth:
    | InstanceType<typeof google.auth.GoogleAuth>
    | InstanceType<typeof google.auth.JWT>;

  if (config.impersonatedUser) {
    const credentials = await loadServiceAccountCredentials(config);

    if (!credentials) {
      throw new Error('Missing service account credentials for Gmail impersonation.');
    }

    auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: GMAIL_READONLY_SCOPES,
      subject: config.impersonatedUser
    });

    await auth.authorize();
  } else {
    const authOptions: ConstructorParameters<typeof google.auth.GoogleAuth>[0] = {
      scopes: GMAIL_READONLY_SCOPES
    };

    if (config.credentialsJson) {
      const credentials = JSON.parse(config.credentialsJson) as ServiceAccountCredentials;
      authOptions.credentials = {
        ...credentials,
        private_key: decodePrivateKey(credentials.private_key)
      };
    } else if (config.credentialsPath) {
      authOptions.keyFile = config.credentialsPath;
    } else {
      getRequiredEnvVar('GOOGLE_APPLICATION_CREDENTIALS');
    }

    auth = new google.auth.GoogleAuth(authOptions);
    await auth.getClient();
  }

  return {
    config,
    gmail: google.gmail({
      version: 'v1',
      auth
    })
  };
}

let gmailClientPromise: Promise<Awaited<ReturnType<typeof createGmailClient>>> | null = null;

async function getGmailClient() {
  if (!gmailClientPromise) {
    gmailClientPromise = createGmailClient();
  }

  return gmailClientPromise;
}

function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
  name: string
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ||
    ''
  );
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8'
  );
}

function extractBodyFromPayload(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) {
    return '';
  }

  const mimeType = payload.mimeType || '';

  if (payload.body?.data && mimeType === 'text/plain') {
    return decodeBase64Url(payload.body.data).trim();
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const nestedBody = extractBodyFromPayload(part);

      if (nestedBody) {
        return nestedBody;
      }
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data).trim();
  }

  return '';
}

function parseMailbox(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:"?([^"]+)"?\s*)?<([^>]+)>$/);

  if (match) {
    return {
      name: (match[1] || '').trim(),
      email: match[2].trim().toLowerCase()
    };
  }

  return {
    name: '',
    email: trimmed.toLowerCase()
  };
}

function isInboundMessage(
  fromEmail: string,
  mailboxUser: string,
  supportAlias: string
) {
  const normalizedFrom = fromEmail.trim().toLowerCase();
  return normalizedFrom !== mailboxUser.toLowerCase() && normalizedFrom !== supportAlias.toLowerCase();
}

function normalizeSubject(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function formatTranscript(messages: GmailSupportMessage[]) {
  return messages
    .map((message) =>
      [
        `From: ${message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}`,
        `To: ${message.to || '—'}`,
        `Date: ${message.sentAt || '—'}`,
        `Subject: ${message.subject || '—'}`,
        '',
        message.body || '(no readable body)'
      ].join('\n')
    )
    .join('\n\n---\n\n');
}

function mapThreadToSupportThread(
  thread: gmail_v1.Schema$Thread,
  mailboxUser: string,
  supportAlias: string
): GmailSupportThread | null {
  const messages = (thread.messages || [])
    .map((message) => {
      const headers = message.payload?.headers;
      const fromHeader = getHeaderValue(headers, 'From');
      const fromMailbox = parseMailbox(fromHeader);
      const subject = normalizeSubject(getHeaderValue(headers, 'Subject'));
      const sentAt = getHeaderValue(headers, 'Date');
      const body = extractBodyFromPayload(message.payload);

      return {
        id: message.id || '',
        fromName: fromMailbox.name,
        fromEmail: fromMailbox.email,
        to: getHeaderValue(headers, 'To'),
        subject,
        sentAt,
        body,
        isInbound: isInboundMessage(fromMailbox.email, mailboxUser, supportAlias)
      } satisfies GmailSupportMessage;
    })
    .filter((message) => message.id);

  if (!thread.id || messages.length === 0) {
    return null;
  }

  const latestMessage = messages[messages.length - 1];
  const latestInboundMessage = [...messages].reverse().find((message) => message.isInbound);
  const customerMessage = latestInboundMessage || latestMessage;

  return {
    threadId: thread.id,
    subject: latestMessage.subject || '(no subject)',
    customerName: customerMessage.fromName || customerMessage.fromEmail || 'Unknown sender',
    customerEmail: customerMessage.fromEmail,
    body: latestInboundMessage?.body || latestMessage.body || '',
    channel: 'email',
    lastUpdatedAt: messageInternalDateToIso(thread.messages?.[thread.messages.length - 1]),
    messages,
    transcript: formatTranscript(messages)
  };
}

function messageInternalDateToIso(message: gmail_v1.Schema$Message | undefined) {
  const rawValue = message?.internalDate;

  if (!rawValue) {
    return '';
  }

  const numericValue = Number(rawValue);

  if (Number.isNaN(numericValue)) {
    return '';
  }

  return new Date(numericValue).toISOString();
}

async function getSupportLabelId() {
  const { gmail, config } = await getGmailClient();
  const response = await gmail.users.labels.list({
    userId: config.mailboxUser
  });

  const label = response.data.labels?.find(
    (candidate) => candidate.name === config.supportLabelName
  );

  if (!label?.id) {
    throw new Error(`Gmail label "${config.supportLabelName}" was not found.`);
  }

  return label.id;
}

export async function listGmailSupportThreads(maxResults = 50) {
  const { gmail, config } = await getGmailClient();
  const labelId = await getSupportLabelId();
  const response = await gmail.users.threads.list({
    userId: config.mailboxUser,
    labelIds: [labelId],
    maxResults
  });

  const threadIds = (response.data.threads || [])
    .map((thread) => thread.id || '')
    .filter(Boolean);

  const threads = await Promise.all(
    threadIds.map(async (threadId) => {
      const threadResponse = await gmail.users.threads.get({
        userId: config.mailboxUser,
        id: threadId,
        format: 'metadata',
        metadataHeaders: GMAIL_METADATA_HEADERS
      });

      return mapThreadToSupportThread(
        threadResponse.data,
        config.mailboxUser,
        config.supportAlias
      );
    })
  );

  return threads
    .filter((thread): thread is GmailSupportThread => Boolean(thread))
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
}

export async function getGmailSupportThread(threadId: string) {
  const { gmail, config } = await getGmailClient();
  const response = await gmail.users.threads.get({
    userId: config.mailboxUser,
    id: threadId,
    format: 'full'
  });

  return mapThreadToSupportThread(response.data, config.mailboxUser, config.supportAlias);
}
