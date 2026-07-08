'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardBody, Chip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Vote } from 'lucide-react';

type PollSummary = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
};

function PollsListSection({
  open,
  closed,
}: {
  open: PollSummary[];
  closed: PollSummary[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="content-container px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Sondages</h1>
        <p className="mt-3 text-muted-foreground">
          Donne ton avis : vote pour la pâtisserie de la semaine, ou pour
          n’importe quel autre sujet que l’équipe te soumet.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-4">
        {open.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Aucun sondage ouvert pour l’instant — reviens bientôt !
          </p>
        )}
        {open.map((poll, i) => (
          <motion.div
            key={poll.id}
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              reduceMotion ? undefined : { duration: 0.5, delay: i * 0.06 }
            }
          >
            <Link href={`/sondages/${poll.id}`}>
              <Card className="border border-default-200/70 transition-shadow hover:shadow-lg">
                <CardBody className="flex-row items-center gap-3 p-5">
                  {poll.imageUrl ? (
                    <Image
                      src={poll.imageUrl}
                      alt={poll.title}
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <Vote className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{poll.title}</p>
                    {poll.description && (
                      <p className="truncate text-sm text-muted-foreground">
                        {poll.description}
                      </p>
                    )}
                  </div>
                  <Chip color="primary" variant="flat" size="sm">
                    Voter
                  </Chip>
                </CardBody>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {closed.length > 0 && (
        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="mb-4 text-center text-lg font-semibold text-muted-foreground">
            Sondages passés
          </h2>
          <div className="space-y-3">
            {closed.map((poll) => (
              <Link key={poll.id} href={`/sondages/${poll.id}`}>
                <Card className="border border-default-200/50 opacity-80 transition-opacity hover:opacity-100">
                  <CardBody className="flex-row items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {poll.imageUrl && (
                        <Image
                          src={poll.imageUrl}
                          alt={poll.title}
                          width={36}
                          height={36}
                          className="size-9 shrink-0 rounded-md object-cover"
                        />
                      )}
                      <p className="truncate text-sm font-medium">
                        {poll.title}
                      </p>
                    </div>
                    <Chip variant="flat" size="sm">
                      Résultats
                    </Chip>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default PollsListSection;
