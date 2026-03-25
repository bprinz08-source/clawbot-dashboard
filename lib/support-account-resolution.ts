import { readFile } from 'fs/promises';
import {
  type SupportAccountResolution,
  type SupportAccountResolutionCandidate,
  type SupportAccountResolutionConfidence,
  type SupportAccountResolutionMethod,
  type SupportAccountResolutionStatus,
  type SupportResolvedContact,
  type SupportResolvedEntityRef
} from '@/lib/support-shared';

type ResolverSnapshotRecord = {
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  accountId?: string;
  accountName?: string;
  accountDomain?: string;
  propertyId?: string;
  propertyName?: string;
  binderId?: string;
  binderName?: string;
};

const DEFAULT_SUPPORT_ACCOUNT_RESOLVER_SNAPSHOT_PATH =
  '/home/gtm-employee/workspaces/asbuilt-support/artifacts/account-resolver-snapshot.json';
const DEFAULT_SUPPORT_ACCOUNT_RESOLVER_SOURCE_VIEW = 'support_account_resolver_source';

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function normalizeDomain(value: unknown) {
  return normalizeString(value).toLowerCase().replace(/^@/, '');
}

function createEntityRef(id: string, name: string): SupportResolvedEntityRef | null {
  if (!id && !name) {
    return null;
  }

  return {
    id,
    name
  };
}

function createContactRef(
  id: string,
  name: string,
  email: string
): SupportResolvedContact | null {
  if (!id && !name && !email) {
    return null;
  }

  return {
    id,
    name,
    email
  };
}

function createCandidate(
  record: ResolverSnapshotRecord,
  matchMethod: SupportAccountResolutionMethod,
  confidence: SupportAccountResolutionConfidence
): SupportAccountResolutionCandidate {
  return {
    matchedContact: createContactRef(
      normalizeString(record.contactId),
      normalizeString(record.contactName),
      normalizeEmail(record.contactEmail)
    ),
    account: createEntityRef(
      normalizeString(record.accountId),
      normalizeString(record.accountName)
    ),
    property: createEntityRef(
      normalizeString(record.propertyId),
      normalizeString(record.propertyName)
    ),
    binder: createEntityRef(
      normalizeString(record.binderId),
      normalizeString(record.binderName)
    ),
    matchMethod,
    confidence
  };
}

function createEmptyResolution(
  status: SupportAccountResolutionStatus = 'unresolved'
): SupportAccountResolution {
  return {
    resolutionStatus: status,
    matchedContact: null,
    account: null,
    property: null,
    binder: null,
    matchMethod: status === 'manual_override' ? 'manual' : 'none',
    confidence: 'low',
    candidateMatches: [],
    resolvedBy: '',
    resolvedAt: ''
  };
}

function getResolverSnapshotPath() {
  return (
    process.env.SUPPORT_ACCOUNT_RESOLVER_SNAPSHOT_PATH?.trim() ||
    DEFAULT_SUPPORT_ACCOUNT_RESOLVER_SNAPSHOT_PATH
  );
}

function getSupabaseResolverConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    '';
  const sourceView =
    process.env.SUPPORT_ACCOUNT_RESOLVER_SOURCE_VIEW?.trim() ||
    DEFAULT_SUPPORT_ACCOUNT_RESOLVER_SOURCE_VIEW;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    sourceView
  };
}

async function querySupabaseResolverRows(query: Record<string, string>) {
  const config = getSupabaseResolverConfig();

  if (!config) {
    return null;
  }

  const url = new URL(`/rest/v1/${config.sourceView}`, config.supabaseUrl);

  url.searchParams.set(
    'select',
    [
      'contact_id',
      'contact_name',
      'contact_email',
      'account_id',
      'account_name',
      'account_domain',
      'property_id',
      'property_name',
      'binder_id',
      'binder_name'
    ].join(',')
  );
  url.searchParams.set('limit', '25');

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
    throw new Error(`Supabase resolver lookup failed (${response.status}).`);
  }

  const payload = (await response.json()) as Array<Record<string, unknown>>;

  return Array.isArray(payload)
    ? payload.map((record) => ({
        contactId: normalizeString(record.contact_id),
        contactName: normalizeString(record.contact_name),
        contactEmail: normalizeEmail(record.contact_email),
        accountId: normalizeString(record.account_id),
        accountName: normalizeString(record.account_name),
        accountDomain: normalizeDomain(record.account_domain),
        propertyId: normalizeString(record.property_id),
        propertyName: normalizeString(record.property_name),
        binderId: normalizeString(record.binder_id),
        binderName: normalizeString(record.binder_name)
      }))
    : [];
}

async function readResolverSnapshot(): Promise<ResolverSnapshotRecord[]> {
  try {
    const rawFile = await readFile(/* turbopackIgnore: true */ getResolverSnapshotPath(), 'utf8');
    const parsed = JSON.parse(rawFile);

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is ResolverSnapshotRecord => Boolean(entry))
      : [];
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function getEmailDomain(email: string) {
  const atIndex = email.indexOf('@');

  return atIndex >= 0 ? email.slice(atIndex + 1) : '';
}

function dedupeCandidates(
  candidates: SupportAccountResolutionCandidate[]
): SupportAccountResolutionCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [
      candidate.matchedContact?.id || candidate.matchedContact?.email || '',
      candidate.account?.id || candidate.account?.name || '',
      candidate.property?.id || candidate.property?.name || '',
      candidate.binder?.id || candidate.binder?.name || '',
      candidate.matchMethod
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildResolvedResolution(
  candidate: SupportAccountResolutionCandidate,
  resolutionStatus: SupportAccountResolutionStatus
): SupportAccountResolution {
  return {
    resolutionStatus,
    matchedContact: candidate.matchedContact,
    account: candidate.account,
    property: candidate.property,
    binder: candidate.binder,
    matchMethod: candidate.matchMethod,
    confidence: candidate.confidence,
    candidateMatches: [],
    resolvedBy: '',
    resolvedAt: ''
  };
}

export async function resolveSupportAccountByEmail(
  email: string
): Promise<SupportAccountResolution> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return createEmptyResolution();
  }

  const exactSourceRows =
    (await querySupabaseResolverRows({ contact_email: `eq.${normalizedEmail}` })) ||
    (await readResolverSnapshot()).filter(
      (record) => normalizeEmail(record.contactEmail) === normalizedEmail
    );
  const exactContactMatches = dedupeCandidates(
    exactSourceRows.map((record) => createCandidate(record, 'exact_email', 'high'))
  );

  if (exactContactMatches.length === 1) {
    return buildResolvedResolution(exactContactMatches[0], 'resolved');
  }

  if (exactContactMatches.length > 1) {
    const uniqueAccountIds = new Set(
      exactContactMatches.map((candidate) => candidate.account?.id || candidate.account?.name)
    );

    if (uniqueAccountIds.size === 1) {
      return {
        ...buildResolvedResolution(
          {
            ...exactContactMatches[0],
            property: null,
            binder: null
          },
          'resolved'
        ),
        candidateMatches: exactContactMatches
      };
    }

    return {
      ...createEmptyResolution('ambiguous'),
      candidateMatches: exactContactMatches
    };
  }

  const emailDomain = getEmailDomain(normalizedEmail);

  if (!emailDomain) {
    return createEmptyResolution();
  }

  const domainSourceRows =
    (await querySupabaseResolverRows({ account_domain: `eq.${emailDomain}` })) ||
    (await readResolverSnapshot()).filter(
      (record) => normalizeDomain(record.accountDomain) === emailDomain
    );
  const domainMatches = dedupeCandidates(
    domainSourceRows.map((record) => createCandidate(record, 'domain', 'medium'))
  );

  if (domainMatches.length === 1) {
    return buildResolvedResolution(
      {
        ...domainMatches[0],
        property: null,
        binder: null
      },
      'resolved'
    );
  }

  if (domainMatches.length > 1) {
    return {
      ...createEmptyResolution('ambiguous'),
      candidateMatches: domainMatches.slice(0, 5)
    };
  }

  return createEmptyResolution();
}

export function applyManualSupportAccountResolution(input: {
  existingResolution: SupportAccountResolution | null;
  resolvedContactId: string;
  matchedContactName: string;
  matchedContactEmail: string;
  accountId: string;
  accountName: string;
  propertyId: string;
  propertyName: string;
  binderId: string;
  binderName: string;
}): SupportAccountResolution | null {
  const matchedContact = createContactRef(
    input.resolvedContactId,
    input.matchedContactName,
    input.matchedContactEmail
  );
  const account = createEntityRef(input.accountId, input.accountName);
  const property = createEntityRef(input.propertyId, input.propertyName);
  const binder = createEntityRef(input.binderId, input.binderName);

  if (!matchedContact && !account && !property && !binder) {
    return input.existingResolution;
  }

  return {
    resolutionStatus: 'manual_override',
    matchedContact,
    account,
    property,
    binder,
    matchMethod: 'manual',
    confidence: 'medium',
    candidateMatches: input.existingResolution?.candidateMatches || [],
    resolvedBy: 'operator',
    resolvedAt: new Date().toISOString()
  };
}
