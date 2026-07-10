'use client';

import { useEffect, useState } from 'react';
import { Link2, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  orderId: string;
  className?: string;
  /** Libellé du bouton copier (défaut « Lien de suivi »). */
  label?: string;
};

/**
 * Lien de suivi de la commande accessible directement depuis les écrans staff
 * (caisse + cuisine) : copie `${origin}/commande/{id}` dans le presse-papier et
 * offre un raccourci « ouvrir ». Utile pour partager le suivi au client ou à
 * son livreur (le client tarde souvent à venir — on lui renvoie le lien).
 *
 * L'URL est calculée côté client (via `window.location.origin`) après montage
 * pour éviter toute divergence d'hydratation.
 */
export function TrackingLinkButton({
  orderId,
  className,
  label = 'Lien de suivi',
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/commande/${orderId}`);
  }, [orderId]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé) : on ouvre à la place.
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-muted/40 px-1',
        className
      )}
    >
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
        ) : (
          <Link2 className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{copied ? 'Lien copié !' : label}</span>
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir le suivi"
          className="inline-flex shrink-0 items-center px-1.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
