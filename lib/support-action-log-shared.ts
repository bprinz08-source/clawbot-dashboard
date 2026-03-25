export type SupportActionLogContext = {
  ticketId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  resolutionStatus: string;
  resolvedAccountId: string;
  resolvedPropertyId: string;
  resolvedBinderId: string;
  needsHumanReview: boolean;
  operatorSource: string;
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeSupportActionLogContext(payload: unknown): SupportActionLogContext {
  if (!payload || typeof payload !== 'object') {
    return {
      ticketId: '',
      customerName: '',
      customerEmail: '',
      subject: '',
      resolutionStatus: 'unresolved',
      resolvedAccountId: '',
      resolvedPropertyId: '',
      resolvedBinderId: '',
      needsHumanReview: false,
      operatorSource: 'support_dashboard'
    };
  }

  const record = payload as Record<string, unknown>;

  return {
    ticketId: normalizeString(record.ticketId),
    customerName: normalizeString(record.customerName),
    customerEmail: normalizeString(record.customerEmail),
    subject: normalizeString(record.subject),
    resolutionStatus: normalizeString(record.resolutionStatus) || 'unresolved',
    resolvedAccountId: normalizeString(record.resolvedAccountId || record.accountId),
    resolvedPropertyId: normalizeString(record.resolvedPropertyId || record.propertyId),
    resolvedBinderId: normalizeString(record.resolvedBinderId || record.binderId),
    needsHumanReview: record.needsHumanReview === true,
    operatorSource: normalizeString(record.operatorSource) || 'support_dashboard'
  };
}
