import type { BuilderRecord } from '@/lib/builder-schema';
import type { AiDraftField } from '@/lib/builder-ai-shared';
import { executeOpenClawAction } from '@/lib/openclaw';

const AI_ACTION_METADATA: Record<
  AiDraftField,
  {
    label: string;
    instructions: string;
  }
> = {
  call_talk_track: {
    label: 'call talk track',
    instructions:
      'Write a concise outreach call talk track for a sales rep. Use short bullet-style lines suitable for a live call. Include an opener, credibility hook, discovery question, and a soft close. Keep it under 140 words.'
  },
  followup_email_draft: {
    label: 'follow-up email',
    instructions:
      'Write a concise follow-up email draft for a sales rep. Start with a clear subject line, then write a short email body. Keep the tone professional and direct. Keep it under 170 words.'
  },
  linkedin_connect_draft: {
    label: 'LinkedIn connection message',
    instructions:
      'Write a short LinkedIn connection request note for a sales rep. Keep it personable and direct, with one clear reason to connect. Keep it under 280 characters.'
  }
};

function getBuilderContext(builder: BuilderRecord) {
  const contextLines = [
    ['Company', builder.company_name],
    ['Website', builder.website],
    ['City', builder.city],
    ['State', builder.state],
    ['Builder type', builder.builder_type],
    ['Contact name', builder.contact_name],
    ['Contact title', builder.contact_title],
    ['Phone', builder.phone],
    ['Email', builder.email],
    ['LinkedIn URL', builder.linkedin_url],
    ['Tier', builder.tier],
    ['Priority', builder.priority],
    ['Status', builder.status],
    ['Last contact date', builder.last_contact_date],
    ['Next action', builder.next_action],
    ['Next action due', builder.next_action_due],
    ['Owner', builder.owner],
    ['Notes', builder.notes]
  ];

  return contextLines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function normalizeOpenClawOutput(stdout: string) {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error('OpenClaw returned an empty draft.');
  }

  return trimmed.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();
}

export async function generateBuilderDraft(
  builder: BuilderRecord,
  draftField: AiDraftField
) {
  const action = AI_ACTION_METADATA[draftField];
  const actionIdByDraftField: Record<AiDraftField, string> = {
    call_talk_track: 'generate_call_talk_track',
    followup_email_draft: 'generate_followup_email',
    linkedin_connect_draft: 'generate_linkedin_connect'
  };

  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_gtm',
    actionId: actionIdByDraftField[draftField],
    payload: {
      objective: 'Generate outreach copy for a builder sales workflow.',
      task: `Generate a ${action.label}.`,
      instructions: action.instructions,
      outputRequirements: [
        'Use only the provided builder data.',
        'Do not fabricate claims, metrics, or personal facts.',
        'If details are missing, keep the copy generic and brief.',
        'Reply ONLY with the draft text.'
      ],
      builder: {
        lead_id: builder.lead_id,
        company_name: builder.company_name,
        website: builder.website,
        city: builder.city,
        state: builder.state,
        builder_type: builder.builder_type,
        contact_name: builder.contact_name,
        contact_title: builder.contact_title,
        phone: builder.phone,
        email: builder.email,
        linkedin_url: builder.linkedin_url,
        tier: builder.tier,
        priority: builder.priority,
        status: builder.status,
        last_contact_date: builder.last_contact_date,
        next_action: builder.next_action,
        next_action_due: builder.next_action_due,
        owner: builder.owner,
        notes: builder.notes,
        context_summary: getBuilderContext(builder)
      }
    }
  });

  const output = normalizeOpenClawOutput(execution.stdout);

  if (!output) {
    throw new Error(execution.stderr.trim() || 'OpenClaw returned an empty draft.');
  }

  return output;
}
