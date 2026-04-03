'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  Button,
  Card,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Send } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const motifs = [
  { key: 'question', label: 'Question generale' },
  { key: 'partenariat', label: 'Partenariat' },
  { key: 'reservation', label: 'Reservation' },
];

function ContactFormSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [motif, setMotif] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [message, setMessage] = useState('');

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.form-image', {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.form-image',
            start: 'top 80%',
          },
        });

        gsap.from('.form-field', {
          y: 20,
          opacity: 0,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.form-fields',
            start: 'top 80%',
          },
        });

        gsap.from('.form-submit', {
          scale: 0.9,
          opacity: 0,
          duration: 0.5,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: '.form-submit',
            start: 'top 90%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="contact-form-title"
      className="bg-muted/35 py-14 md:py-20"
    >
      <div className="content-container px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="form-image">
            <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-xl">
              <div className="relative h-72 w-full sm:h-80 lg:h-120">
                <Image
                  src="/assets/examples/accueil/eba-hero.webp"
                  alt="Ambiance cafe et patisserie chez EBA"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Card>
          </div>

          <div>
            <h2
              id="contact-form-title"
              className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Ecrivez-nous
            </h2>

            <form
              className="form-fields space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="form-field">
                <Select
                  label="Motif"
                  placeholder="Choisissez un motif"
                  selectedKeys={motif ? [motif] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    setMotif(selected ? String(selected) : '');
                  }}
                  isRequired
                >
                  {motifs.map((m) => (
                    <SelectItem key={m.key}>{m.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="form-field">
                <Input
                  label="Nom complet"
                  placeholder="Votre nom"
                  value={nom}
                  onValueChange={setNom}
                  isRequired
                />
              </div>

              <div className="form-field">
                <Input
                  label="Email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onValueChange={setEmail}
                  isRequired
                />
              </div>

              <div className="form-field">
                <Input
                  label="Telephone"
                  type="tel"
                  placeholder="+225 00 00 00 00 00"
                  value={telephone}
                  onValueChange={setTelephone}
                />
              </div>

              <div className="form-field">
                <Textarea
                  label="Message"
                  placeholder="Votre message..."
                  value={message}
                  onValueChange={setMessage}
                  minRows={4}
                  isRequired
                />
              </div>

              <div className="form-submit pt-2">
                <Button
                  type="submit"
                  color="primary"
                  radius="full"
                  size="lg"
                  className="px-8"
                  startContent={<Send aria-hidden="true" className="h-4 w-4" />}
                >
                  Envoyer le message
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
