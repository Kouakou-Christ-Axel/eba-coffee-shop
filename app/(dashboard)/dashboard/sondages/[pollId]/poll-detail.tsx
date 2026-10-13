'use client';

import type { OptionRow, SuggestionRow } from './_components/types';
import { AddOptionForm } from './_components/add-option-form';
import { OptionsTable } from './_components/options-table';
import { SuggestionsPanel } from './_components/suggestions-panel';
import { usePollDetail } from './_components/use-poll-detail';

export function PollDetail({
  pollId,
  options,
  totalVotes,
  suggestions,
  allowSuggestions,
}: {
  pollId: string;
  options: OptionRow[];
  totalVotes: number;
  suggestions: SuggestionRow[];
  allowSuggestions: boolean;
}) {
  const poll = usePollDetail({ pollId, suggestions });

  return (
    <div className="space-y-8">
      {poll.error && <p className="text-sm text-destructive">{poll.error}</p>}

      <OptionsTable options={options} totalVotes={totalVotes} poll={poll} />

      <AddOptionForm poll={poll} />

      {allowSuggestions && <SuggestionsPanel poll={poll} />}
    </div>
  );
}
