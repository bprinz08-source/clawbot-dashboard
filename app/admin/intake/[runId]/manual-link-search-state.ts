export type ManualLinkCandidate = {
  query: string;
  source_label: string;
  title: string;
  url: string;
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
