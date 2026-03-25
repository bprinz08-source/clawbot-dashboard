import { listSupportQueueItems } from '@/lib/support-operator';
import type { SupportQueueItem } from '@/lib/support-operator-shared';

export type SupportQueueSummaryItem = {
  ticketId: string;
  customerName: string;
  subject: string;
  currentStatus: string;
  lastUpdatedAt: string;
  needsHumanReview: boolean;
};

export type SupportQueueSummary = {
  totalOpenSupportItems: number;
  countNeedingHumanReview: number;
  countWithDraftReplyReady: number;
  countWithEscalationDraftReady: number;
  topItems: SupportQueueSummaryItem[];
  dashboardLink: string;
  slackText: string;
};

function getDashboardBaseUrl() {
  return (
    process.env.PUBLIC_DASHBOARD_BASE_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/g, '');
}

function buildDashboardLink() {
  return `${getDashboardBaseUrl()}/?workspace=support`;
}

function isOpenSupportItem(ticket: SupportQueueItem) {
  return ticket.currentStatus !== 'closed';
}

function getUrgencyScore(ticket: SupportQueueItem) {
  let score = 0;

  if (ticket.needsHumanReview) {
    score += 100;
  }

  if (ticket.currentStatus === 'escalated') {
    score += 80;
  }

  if (ticket.currentStatus === 'needs_review') {
    score += 60;
  }

  if (ticket.currentStatus === 'open') {
    score += 40;
  }

  if (ticket.hasEscalationDraft) {
    score += 10;
  }

  if (ticket.hasDraftReply) {
    score += 5;
  }

  return score;
}

function summarizeTopItem(ticket: SupportQueueItem): SupportQueueSummaryItem {
  return {
    ticketId: ticket.ticketId,
    customerName: ticket.customerName,
    subject: ticket.subject,
    currentStatus: ticket.currentStatus,
    lastUpdatedAt: ticket.lastUpdatedAt,
    needsHumanReview: ticket.needsHumanReview
  };
}

function buildSlackText(
  summary: Omit<SupportQueueSummary, 'slackText'>
) {
  const headline = `You have ${summary.totalOpenSupportItems} open support item${summary.totalOpenSupportItems === 1 ? '' : 's'}.`;
  const counts = `Human review: ${summary.countNeedingHumanReview}, draft replies: ${summary.countWithDraftReplyReady}, escalation drafts: ${summary.countWithEscalationDraftReady}.`;
  const topItems =
    summary.topItems.length > 0
      ? `Top items: ${summary.topItems
          .map((item) => `${item.customerName || 'Unknown'} - ${item.subject || item.ticketId}`)
          .join(' | ')}.`
      : 'No active queue items.';

  return `${headline} ${counts} ${topItems} Dashboard: ${summary.dashboardLink}`;
}

export async function getSupportQueueSummary(): Promise<SupportQueueSummary> {
  const tickets = await listSupportQueueItems();
  const openTickets = tickets.filter(isOpenSupportItem);

  const summaryBase = {
    totalOpenSupportItems: openTickets.length,
    countNeedingHumanReview: openTickets.filter((ticket) => ticket.needsHumanReview).length,
    countWithDraftReplyReady: openTickets.filter((ticket) => ticket.hasDraftReply).length,
    countWithEscalationDraftReady: openTickets.filter((ticket) => ticket.hasEscalationDraft)
      .length,
    topItems: [...openTickets]
      .sort((left, right) => {
        const scoreDelta = getUrgencyScore(right) - getUrgencyScore(left);

        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return right.lastUpdatedAt.localeCompare(left.lastUpdatedAt);
      })
      .slice(0, 3)
      .map(summarizeTopItem),
    dashboardLink: buildDashboardLink()
  };

  return {
    ...summaryBase,
    slackText: buildSlackText(summaryBase)
  };
}
