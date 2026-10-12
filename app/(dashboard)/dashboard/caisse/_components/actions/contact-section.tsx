'use client';

import { Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrderView } from './use-order-view';

export function ContactSection({ view }: { view: OrderView }) {
  const { phone, telLink, whatsappLink } = view;
  return (
    <>
      {/* Ligne contact : Appeler + Wave (2 colonnes) */}
      {phone && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!telLink}
          >
            {telLink ? (
              <a href={telLink}>
                <Phone className="mr-1.5 h-4 w-4" />
                Appeler
              </a>
            ) : (
              <span>Appeler</span>
            )}
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!whatsappLink}
          >
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Wave
              </a>
            ) : (
              <span>Wave</span>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
