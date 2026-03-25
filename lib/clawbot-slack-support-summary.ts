type SupportSummaryTopItem = {
  customerName: string;
  subject: string;
  ticketId: string;
};

export type SupportSummarySlackShape = {
  totalOpenSupportItems: number;
  countNeedingHumanReview: number;
  topItems: SupportSummaryTopItem[];
  dashboardLink: string;
};

const SUPPORT_SUMMARY_PATTERNS = [
  /\bgive me the support summary\b/i,
  /\bdo i have support items to attend to\b/i,
  /\bany support items\b/i,
  /\bsupport status\b/i
];

function normalizeQuestion(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function buildTopItemLabel(item: SupportSummaryTopItem) {
  const customerName = item.customerName.trim();
  const subject = item.subject.trim();

  if (customerName && subject) {
    return `${customerName} - ${subject}`;
  }

  if (customerName) {
    return customerName;
  }

  if (subject) {
    return subject;
  }

  return item.ticketId.trim() || 'Unknown ticket';
}

export function matchesSupportSummaryQuestion(text: string) {
  const normalizedQuestion = normalizeQuestion(text);

  return SUPPORT_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));
}

export function formatSupportSummarySlackReply(summary: SupportSummarySlackShape) {
  const dashboard = `Dashboard: ${summary.dashboardLink}`;

  if (summary.totalOpenSupportItems === 0) {
    return `No open support items right now. ${dashboard}`;
  }

  const itemLabel =
    summary.topItems.length > 0
      ? ` Top item: ${buildTopItemLabel(summary.topItems[0])}.`
      : '';

  return `Yes. ${summary.totalOpenSupportItems} open support item${summary.totalOpenSupportItems === 1 ? '' : 's'}, ${summary.countNeedingHumanReview} needing human review.${itemLabel} ${dashboard}`;
}
