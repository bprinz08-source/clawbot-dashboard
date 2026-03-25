import { NextResponse } from 'next/server';
import {
  getClawbotGmailSender,
  sendClawbotTestEmail
} from '@/lib/clawbot-gmail-send';

type SendTestEmailInput = {
  to: string;
  subject: string;
  body: string;
};

function normalizeSendTestEmailInput(payload: unknown): SendTestEmailInput | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const to = typeof record.to === 'string' ? record.to.trim() : '';
  const subject = typeof record.subject === 'string' ? record.subject.trim() : '';
  const body = typeof record.body === 'string' ? record.body.trim() : '';

  if (!to || !subject || !body) {
    return null;
  }

  return {
    to,
    subject,
    body
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const input = normalizeSendTestEmailInput(payload);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid test email payload'
        },
        { status: 400 }
      );
    }

    const result = await sendClawbotTestEmail(input);

    return NextResponse.json({
      success: true,
      sender: getClawbotGmailSender(),
      messageId: result.id,
      threadId: result.threadId,
      labelIds: result.labelIds
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email.'
      },
      { status: 500 }
    );
  }
}
