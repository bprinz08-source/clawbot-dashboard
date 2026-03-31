export type ManualLinkCandidate = {
  query: string;
  source_label: string;
  title: string;
  url: string;
};

export type ManualLinkStageResult = {
  created: boolean;
  error: string | null;
  intake_item_id: string | null;
  intake_run_id: string | null;
  message: string | null;
};

export type DownloadStoreManualResult = {
  error: string | null;
  file_name: string | null;
  file_path: string | null;
  message: string | null;
  project_manual_id: string | null;
  status: 'created' | 'updated' | 'already_imported' | null;
};

export type ManualLinkSearchState = {
  error: string | null;
  product: {
    brand: string;
    category: string;
    model: string;
    title: string;
  } | null;
  queries: string[];
  candidates: ManualLinkCandidate[];
};

export const initialManualLinkSearchState: ManualLinkSearchState = {
  error: null,
  product: null,
  queries: [],
  candidates: []
};

export const initialManualLinkStageResult: ManualLinkStageResult = {
  created: false,
  error: null,
  intake_item_id: null,
  intake_run_id: null,
  message: null
};

export const initialDownloadStoreManualResult: DownloadStoreManualResult = {
  error: null,
  file_name: null,
  file_path: null,
  message: null,
  project_manual_id: null,
  status: null
};
