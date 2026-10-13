import {
  emptyPollScalarValues,
  type PollScalarValues,
} from '../../poll-form-fields';

export type PollRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  allowSuggestions: boolean;
  resultsVisibility: 'LIVE' | 'AFTER_CLOSE';
  optionsCount: number;
  votesCount: number;
  pendingSuggestionsCount: number;
};

export type CreateValues = PollScalarValues & { options: string[] };

export const emptyCreate: CreateValues = {
  ...emptyPollScalarValues,
  options: ['', ''],
};

export const STATUS_LABELS: Record<PollRow['status'], string> = {
  DRAFT: 'Préparation',
  OPEN: 'Ouvert',
  CLOSED: 'Clôturé',
};
