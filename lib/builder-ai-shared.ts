export const AI_DRAFT_FIELDS = [
  'call_talk_track',
  'followup_email_draft',
  'linkedin_connect_draft'
] as const;

export type AiDraftField = (typeof AI_DRAFT_FIELDS)[number];
