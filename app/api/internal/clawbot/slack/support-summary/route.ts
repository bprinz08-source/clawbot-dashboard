import { NextResponse, type NextRequest } from 'next/server';
import { authorizeClawbotInternalRequest } from '@/lib/internal-api-auth';
import {
  formatSupportSummarySlackReply,
  matchesSupportSummaryQuestion,
  type SupportSummarySlackShape
} from '@/lib/clawbot-slack-support-summary';

type SlackSupportSummaryRequest = {
  action: 'support_summary';
  text: string;
};

type SupportSummaryApiResponse = {
  success: boolean;
  error?: string;
  summary?: SupportSummarySlackShape;
};

function normalizeSlackSupportSummaryRequest(
  payload: unknown
): SlackSupportSummaryRequest | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const action = typeof record.action === 'string' ? record.action.trim() : '';
  const text = typeof record.text === 'string' ? record.text.trim() : '';

  if (action !== 'support_summary' || !text) {
    return null;
  }

  return {
    action: 'support_summary',
    text
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!authorizeClawbotInternalRequest(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized.'
        },
        { status: 401 }
      );
    }

    const payload = await request.json().catch(() => null);
    const input = normalizeSlackSupportSummaryRequest(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid support_summary payload.'
        },
        { status: 400 }
      );
    }

    if (!matchesSupportSummaryQuestion(input.text)) {
      return NextResponse.json({
        success: true,
        action: 'support_summary',
        matched: false
      });
    }

    const summaryResponse = await fetch(new URL('/api/support/summary', request.url), {
      method: 'GET',
      cache: 'no-store'
    });

    const result = (await summaryResponse.json().catch(() => null)) as SupportSummaryApiResponse | null;

    if (!summaryResponse.ok || !result?.success || !result.summary) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || 'Failed to load support summary.'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'support_summary',
      matched: true,
      reply: formatSupportSummarySlackReply(result.summary),
      dashboardLink: result.summary.dashboardLink
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process support_summary action.'
      },
      { status: 500 }
    );
  }
}
