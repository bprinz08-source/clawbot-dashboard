export const RECOMMENDED_CONTACT_FIELDS = [
  'recommended_contact_name',
  'recommended_contact_title',
  'recommended_contact_url',
  'recommended_contact_linkedin_url',
  'recommended_contact_confidence',
  'recommended_contact_summary',
  'call_path_hint'
] as const;

export type RecommendedContactField = (typeof RECOMMENDED_CONTACT_FIELDS)[number];
