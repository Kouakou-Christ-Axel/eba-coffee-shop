// Écritures des sondages (moteur de vote, suggestions, modération). Implémentation dans `lib/polls/mutations/`.

export {
  createPoll,
  updatePoll,
  setPollStatus,
  deletePoll,
} from './polls/mutations/polls';
export {
  createPollOption,
  updatePollOption,
  deletePollOption,
  movePollOption,
} from './polls/mutations/options';
export {
  submitPollSuggestion,
  setPollSuggestionImage,
  moderatePollSuggestion,
} from './polls/mutations/suggestions';
export { castVote } from './polls/mutations/votes';
