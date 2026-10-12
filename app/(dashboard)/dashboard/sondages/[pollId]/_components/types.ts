export type OptionRow = {
  id: string;
  label: string;
  description: string | null;
  imageUrl: string | null;
  deletedAt: Date | null;
  votes: number;
};

export type SuggestionRow = {
  id: string;
  label: string;
  description: string | null;
  imageUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitterName: string | null;
  submitterPhone: string | null;
  rejectionReason: string | null;
};
