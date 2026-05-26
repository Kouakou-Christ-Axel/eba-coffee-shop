'use client';

import { Textarea } from '@heroui/react';
import { ORDER_NOTE_MAX } from '@/config/constants';

type NoteFieldProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function NoteField({ value, error, onChange }: NoteFieldProps) {
  return (
    <Textarea
      label="Note (optionnel)"
      placeholder="Allergies, demande spéciale…"
      value={value}
      onValueChange={onChange}
      isInvalid={!!error}
      errorMessage={error}
      maxLength={ORDER_NOTE_MAX}
      description={`${value.length} / ${ORDER_NOTE_MAX}`}
      minRows={2}
    />
  );
}
