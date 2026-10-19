import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RefundStatus } from '@/generated/prisma/client';
import {
  REFUND_STATUS_LABELS,
  REFUND_STATUS_TONES,
  type RefundTone,
} from '@/lib/refunds/labels';

const TONE_CLASS: Record<RefundTone, string> = {
  neutral: '',
  warning: 'border-amber-500/40 bg-amber-500/15 text-amber-700',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  success: 'border-green-600/40 bg-green-600/10 text-green-700',
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap',
        TONE_CLASS[REFUND_STATUS_TONES[status]]
      )}
    >
      {REFUND_STATUS_LABELS[status]}
    </Badge>
  );
}
