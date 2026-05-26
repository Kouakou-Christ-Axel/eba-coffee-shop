'use client';

import { Input, Select, SelectItem, Textarea } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  ContactFormErrors,
  ContactFormValues,
} from '@/lib/hooks/use-contact-form';

const motifs = [
  { key: 'question', label: 'Question generale' },
  { key: 'reservation', label: 'Reservation' },
  { key: 'partenariat', label: 'Partenariat' },
] as const;

const fieldClassNames = {
  inputWrapper:
    'border-default-300/80 bg-content1/90 backdrop-blur-sm group-data-[focus=true]:border-primary/70 group-data-[focus=true]:bg-content1',
  input: 'text-foreground',
  label: 'text-foreground/75',
} as const;

type Props = {
  values: ContactFormValues;
  errors: ContactFormErrors;
  setField: <K extends keyof ContactFormValues>(
    key: K,
    value: ContactFormValues[K]
  ) => void;
};

export function ContactFormFields({ values, errors, setField }: Props) {
  const reduceMotion = useReducedMotion();

  const itemProps = reduceMotion
    ? {}
    : ({
        variants: {
          hidden: { opacity: 0, y: 18 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: 'easeOut' as const },
          },
        },
      } as const);

  return (
    <>
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        {...itemProps}
      >
        <Input
          label="Nom complet"
          placeholder="Votre nom"
          variant="bordered"
          radius="lg"
          classNames={fieldClassNames}
          isRequired
          value={values.name}
          onValueChange={(v) => setField('name', v)}
          isInvalid={!!errors.name}
          errorMessage={errors.name}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          placeholder="votre@email.com"
          variant="bordered"
          radius="lg"
          classNames={fieldClassNames}
          isRequired
          value={values.email}
          onValueChange={(v) => setField('email', v)}
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          autoComplete="email"
        />
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        {...itemProps}
      >
        <Input
          label="Telephone"
          type="tel"
          placeholder="+225 00 00 00 00 00"
          variant="bordered"
          radius="lg"
          classNames={fieldClassNames}
          value={values.phone}
          onValueChange={(v) => setField('phone', v)}
          isInvalid={!!errors.phone}
          errorMessage={errors.phone}
          autoComplete="tel"
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
          selectedKeys={values.subject ? [values.subject] : []}
          isInvalid={!!errors.subject}
          errorMessage={errors.subject}
          onSelectionChange={(keys) => {
            if (keys === 'all') {
              setField('subject', '');
              return;
            }
            const selected = Array.from(keys)[0];
            const v = selected ? String(selected) : '';
            if (
              v === '' ||
              v === 'question' ||
              v === 'reservation' ||
              v === 'partenariat'
            ) {
              setField('subject', v);
            }
          }}
        >
          {motifs.map((m) => (
            <SelectItem key={m.key}>{m.label}</SelectItem>
          ))}
        </Select>
      </motion.div>

      <motion.div {...itemProps}>
        <Textarea
          label="Message"
          placeholder="Votre message..."
          variant="bordered"
          radius="lg"
          minRows={5}
          classNames={fieldClassNames}
          isRequired
          value={values.message}
          onValueChange={(v) => setField('message', v)}
          isInvalid={!!errors.message}
          errorMessage={errors.message}
        />
      </motion.div>
    </>
  );
}
