export const JOB_HUNT_STATUSES = [
  'New',
  'Reviewing',
  'Qualified',
  'Not a fit',
  'Ready to apply',
  'Applied',
  'Follow-up due',
  'Recruiter conversation',
  'Interviewing',
  'Offer',
  'Rejected',
  'Archived'
] as const;

export const JOB_HUNT_LANES = [
  'Enterprise AE / Strategic AE',
  'Founding AE / Early GTM',
  'AI-Adjacent GTM / Operator Roles'
] as const;

export type JobHuntStatus = (typeof JOB_HUNT_STATUSES)[number];
export type JobHuntLane = (typeof JOB_HUNT_LANES)[number];

export type JobHuntRole = {
  opportunity_id: string;
  lane: JobHuntLane;
  company_name: string;
  role_title: string;
  location: string;
  work_model: string;
  compensation_estimate: string;
  source: string;
  posting_url: string;
  date_found: string;
  status: JobHuntStatus;
  fit_score: number;
  story_match_score: number;
  urgency_score: number;
  why_this_role: string;
  why_brandon_wins_here: string;
  narrative_angle: string;
  resume_version: string;
  follow_up_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
};
