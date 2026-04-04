'use client';

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, MapPin, MessageCircle, Send } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

const motifs = [
  { key: 'question', label: 'Question generale' },
  { key: 'reservation', label: 'Reservation' },
  { key: 'partenariat', label: 'Partenariat' },
] as const;

const infoItems = [
  {
    label: 'Adresse',
    value: brandConfig.links.contact.address,
    icon: MapPin,
  },
  {
    label: 'Horaires',
    value: brandConfig.links.contact.hours,
    icon: Clock3,
  },
  {
    label: 'WhatsApp',
    value: brandConfig.links.contact.whatsapp.display,
    icon: MessageCircle,
  },
] as const;

const fieldClassNames = {
  inputWrapper:
    'border-default-300/80 bg-content1/90 backdrop-blur-sm group-data-[focus=true]:border-primary/70 group-data-[focus=true]:bg-content1',
  input: 'text-foreground',
  label: 'text-foreground/75',
} as const;

function ContactFormSection() {
  const reduceMotion = useReducedMotion();
  const [motif, setMotif] = useState('');

  const containerVariants = reduceMotion
    ? {}
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, amount: 0.25 },
        variants: {
          hidden: {},
          visible: { transition: { staggerChildren: 0.07 } },
        },
      };

  const itemVariants = reduceMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 18 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: 'easeOut' as const },
          },
        },
      };

  return (
    <section
      aria-labelledby="contact-form-title"
      className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(248,242,235,1)_100%)] py-16 md:py-24"
    >
      <div
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-primary/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-0 h-64 w-64 rounded-full bg-secondary/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="content-container relative px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <motion.div
            {...containerVariants}
            className="rounded-3xl border border-default-200/70 bg-content1/80 p-6 shadow-lg shadow-black/5 backdrop-blur-sm md:p-8"
          >
            <motion.p
              className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
              {...itemVariants}
            >
              Contact EBA
            </motion.p>
            <motion.h2
              id="contact-form-title"
              className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              {...itemVariants}
            >
              Ecrivons ensemble votre prochaine experience
            </motion.h2>
            <motion.p
              className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base"
              {...itemVariants}
            >
              Une question, une reservation ou un partenariat ? Notre equipe
              vous repond rapidement avec attention.
            </motion.p>

            <motion.ul className="mt-7 space-y-3" role="list" {...itemVariants}>
              {infoItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="flex items-start gap-3 rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3"
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        {item.label}
                      </p>
                      <p className="text-sm font-medium text-foreground/85">
                        {item.value}
                      </p>
                    </div>
                  </li>
                );
              })}
            </motion.ul>
          </motion.div>

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.65, ease: 'easeOut', delay: 0.08 }
            }
          >
            <Card className="rounded-3xl border border-default-200/70 bg-background/90 shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardBody className="p-5 sm:p-7">
                <motion.form
                  onSubmit={(e) => e.preventDefault()}
                  className="space-y-4"
                  {...containerVariants}
                >
                  <motion.div
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    {...itemVariants}
                  >
                    <Input
                      label="Nom complet"
                      placeholder="Votre nom"
                      variant="bordered"
                      radius="lg"
                      classNames={fieldClassNames}
                      isRequired
                    />
                    <Input
                      label="Email"
                      type="email"
                      placeholder="votre@email.com"
                      variant="bordered"
                      radius="lg"
                      classNames={fieldClassNames}
                      isRequired
                    />
                  </motion.div>

                  <motion.div
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    {...itemVariants}
                  >
                    <Input
                      label="Telephone"
                      type="tel"
                      placeholder="+225 00 00 00 00 00"
                      variant="bordered"
                      radius="lg"
                      classNames={fieldClassNames}
                    />
                    <Select
                      label="Motif"
                      placeholder="Choisissez un motif"
                      variant="bordered"
                      radius="lg"
                      classNames={{
                        trigger: fieldClassNames.inputWrapper,
                        label: fieldClassNames.label,
                        value: 'text-foreground/70',
                      }}
                      selectedKeys={motif ? [motif] : []}
                      onSelectionChange={(keys) => {
                        if (keys === 'all') {
                          setMotif('');
                          return;
                        }
                        const selected = Array.from(keys)[0];
                        setMotif(selected ? String(selected) : '');
                      }}
                    >
                      {motifs.map((m) => (
                        <SelectItem key={m.key}>{m.label}</SelectItem>
                      ))}
                    </Select>
                  </motion.div>

                  <motion.div {...itemVariants}>
                    <Textarea
                      label="Message"
                      placeholder="Votre message..."
                      variant="bordered"
                      radius="lg"
                      minRows={5}
                      classNames={fieldClassNames}
                      isRequired
                    />
                  </motion.div>

                  <motion.div className="pt-2" {...itemVariants}>
                    <Button
                      type="submit"
                      color="primary"
                      radius="full"
                      size="lg"
                      className="w-full px-8 sm:w-auto"
                      endContent={
                        <Send aria-hidden="true" className="h-4 w-4" />
                      }
                    >
                      Envoyer le message
                    </Button>
                  </motion.div>
                </motion.form>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
