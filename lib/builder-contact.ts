import type { BuilderRecord, BuilderPatch } from '@/lib/builder-schema';
import {
  RECOMMENDED_CONTACT_FIELDS,
  type RecommendedContactField
} from '@/lib/builder-contact-shared';
import { executeOpenClawAction } from '@/lib/openclaw';

export type RecommendedContactResult = Record<RecommendedContactField, string>;

function createEmptyRecommendedContactResult(): RecommendedContactResult {
  return RECOMMENDED_CONTACT_FIELDS.reduce((result, field) => {
    result[field] = '';
    return result;
  }, {} as RecommendedContactResult);
}

function getBuilderContext(builder: BuilderRecord) {
  const contextLines = [
    ['Company', builder.company_name],
    ['Website', builder.website],
    ['City', builder.city],
    ['State', builder.state],
    ['Builder type', builder.builder_type],
    ['Current contact name', builder.contact_name],
    ['Current contact title', builder.contact_title],
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

function extractJsonObject(rawOutput: string) {
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    throw new Error('OpenClaw returned an empty contact result.');
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('OpenClaw did not return valid JSON.');
  }

  return jsonMatch[0];
}

function normalizeContactValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecommendedContactResult(rawResult: unknown) {
  if (!rawResult || typeof rawResult !== 'object') {
    throw new Error('OpenClaw returned malformed contact JSON.');
  }

  const normalizedResult = createEmptyRecommendedContactResult();

  for (const field of RECOMMENDED_CONTACT_FIELDS) {
    normalizedResult[field] = normalizeContactValue(
      (rawResult as Partial<Record<RecommendedContactField, unknown>>)[field]
    );
  }

  const confidence = normalizedResult.recommended_contact_confidence.toLowerCase();

  if (confidence && !['high', 'medium', 'low'].includes(confidence)) {
    normalizedResult.recommended_contact_confidence = '';
  } else {
    normalizedResult.recommended_contact_confidence = confidence;
  }

  return normalizedResult;
}

export async function findBestContact(builder: BuilderRecord) {
  const execution = await executeOpenClawAction({
    workspaceId: 'asbuilt_gtm',
    actionId: 'find_best_contact',
    payload: {
      objective: 'Research the best buyer or contact for a home builder outreach workflow.',
      sourcePolicy: [
        'Use public sources only.',
        'Prioritize builder website team/about/contact pages.',
        'Use leadership/staff pages, LinkedIn company/person pages if available, and public builder directory pages.'
      ],
      outputRequirements: [
        'Return one best recommendation only.',
        'Keep output compact and practical for an operator making calls.',
        'If a field is unknown, return an empty string.',
        'Set recommended_contact_confidence to exactly high, medium, or low.',
        'recommended_contact_summary should be one short sentence.',
        'call_path_hint should be one short sentence telling the rep who to ask for or what role to request.',
        'Reply ONLY with valid JSON.'
      ],
      requiredFields: RECOMMENDED_CONTACT_FIELDS,
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

  const rawJson = extractJsonObject(execution.stdout);

  try {
    return normalizeRecommendedContactResult(JSON.parse(rawJson));
  } catch (error) {
    const stderrMessage = execution.stderr.trim();

    if (stderrMessage) {
      throw new Error(stderrMessage);
    }

    throw error;
  }
}

export function recommendedContactResultToPatch(
  result: RecommendedContactResult
): BuilderPatch {
  return { ...result };
}
