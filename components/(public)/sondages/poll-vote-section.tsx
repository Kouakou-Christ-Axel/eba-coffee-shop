'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, Input, Radio, RadioGroup } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { castVoteAction, getMyVoteAction } from '@/app/(public)/sondages/actions';
import PollResultsSection from './poll-results-section';
import PastrySuggestionForm from './pastry-suggestion-form';

const VOTER_TOKEN_KEY = 'eba_poll_voter_token';

function getOrCreateVoterToken(): string {
  let token = localStorage.getItem(VOTER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(VOTER_TOKEN_KEY, token);
  }
  return token;
}

type PollOption = {
  id: string;
  label: string;
  description: string | null;
  imageUrl: string | null;
};

type PollResults = {
  totalVotes: number;
  options: { optionId: string; label: string; votes: number; percentage: number }[];
};

function PollVoteSection({
  pollId,
  title,
  description,
  imageUrl,
  status,
  allowSuggestions,
  options,
  results,
}: {
  pollId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  allowSuggestions: boolean;
  options: PollOption[];
  results: PollResults | null;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState('');
  const [phone, setPhone] = useState('');
  // Lazy init : lu/écrit uniquement côté client (localStorage indisponible en
  // SSR) — la valeur ne sert qu'à la soumission, jamais au rendu, donc pas de
  // risque de désaccord d'hydratation.
  const [voterToken] = useState(() =>
    typeof window === 'undefined' ? '' : getOrCreateVoterToken()
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Un vote préexistant (retrouvé via le token) OU un vote qui vient d'être
  // soumis avec succès dans cette session — dans les deux cas le formulaire
  // reste affiché pour permettre de changer de choix, contrairement à avant
  // où il disparaissait derrière un simple message de remerciement.
  const [hasVoted, setHasVoted] = useState(false);
  const [justVotedLabel, setJustVotedLabel] = useState<string | null>(null);

  // Pré-sélectionne le choix déjà voté par CET appareil (token anonyme), pour
  // permettre de revoter sans redécouvrir son ancien choix.
  useEffect(() => {
    if (!voterToken || status !== 'OPEN') return;
    getMyVoteAction(pollId, voterToken)
      .then((r) => {
        if (r.optionId) {
          setSelected(r.optionId);
          setHasVoted(true);
        }
      })
      .catch(() => {});
  }, [pollId, voterToken, status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustVotedLabel(null);
    if (!selected) {
      setError('Choisis une option pour voter.');
      return;
    }
    setSubmitting(true);
    const r = await castVoteAction(pollId, {
      optionId: selected,
      phone: phone.trim() || undefined,
      voterToken,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setHasVoted(true);
    setJustVotedLabel(
      options.find((o) => o.id === selected)?.label ?? null
    );
    // Rafraîchit les données serveur (résultats, statut) pour que le tableau
    // de résultats reflète immédiatement ce vote — sans ça, l'écran restait
    // figé sur le décompte lu au premier chargement de la page, donnant
    // l'impression qu'un revote (changement d'option) n'était pas pris en
    // compte.
    router.refresh();
  }

  const canVote = status === 'OPEN';

  return (
    <section className="content-container px-6 py-16 md:py-24">
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.5 }}
        className="mx-auto max-w-2xl"
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            width={640}
            height={320}
            className="mb-6 aspect-[2/1] w-full rounded-2xl object-cover"
          />
        )}
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}

        {canVote ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {(justVotedLabel || hasVoted) && (
              <Card className="border border-primary/30 bg-primary/5">
                <CardBody className="flex-row items-center gap-3 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm">
                    {justVotedLabel
                      ? `Vote enregistré pour « ${justVotedLabel} ».`
                      : 'Tu as déjà voté pour ce sondage.'}{' '}
                    Tu peux changer d’avis ci-dessous tant que le vote reste
                    ouvert.
                  </p>
                </CardBody>
              </Card>
            )}

            <RadioGroup
              value={selected}
              onValueChange={(v) => {
                setSelected(v);
                setJustVotedLabel(null);
              }}
            >
              {options.map((o) => (
                <Radio key={o.id} value={o.id} className="mb-2">
                  <div className="flex items-center gap-3">
                    {o.imageUrl && (
                      <Image
                        src={o.imageUrl}
                        alt={o.label}
                        width={48}
                        height={48}
                        className="size-12 rounded-md object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">{o.label}</p>
                      {o.description && (
                        <p className="text-xs text-muted-foreground">
                          {o.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Radio>
              ))}
            </RadioGroup>

            <Input
              label="Ton téléphone (optionnel)"
              description="Pour confirmer ton vote — sinon on garde juste ton appareil en mémoire."
              type="tel"
              value={phone}
              onValueChange={setPhone}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button
              type="submit"
              color="primary"
              radius="full"
              size="lg"
              isLoading={submitting}
              isDisabled={submitting}
            >
              {hasVoted ? 'Mettre à jour mon vote' : 'Voter'}
            </Button>
          </form>
        ) : status === 'DRAFT' ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Le vote n’est pas encore ouvert.
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Ce sondage est clôturé — voici les résultats.
          </p>
        )}

        {results && (
          <div className="mt-8">
            <PollResultsSection results={results} />
          </div>
        )}

        {allowSuggestions && status !== 'CLOSED' && (
          <div className="mt-8">
            <PastrySuggestionForm pollId={pollId} />
          </div>
        )}
      </motion.div>
    </section>
  );
}

export default PollVoteSection;
