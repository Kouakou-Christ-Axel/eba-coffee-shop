'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Link } from '@heroui/react';
import { brandConfig } from '@/config/brand.config';

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-background to-default-100 px-4 py-12">
      <Card className="w-full max-w-2xl border border-default-200/60 bg-background/85 shadow-xl backdrop-blur">
        <CardHeader className="flex flex-col gap-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Erreur 404
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Oups, cette page est introuvable
          </h1>
          <p className="max-w-xl text-default-600">
            La page que vous cherchez n&apos;existe peut-etre plus ou son lien
            est incorrect. Vous pouvez continuer votre visite via les raccourcis
            ci-dessous.
          </p>
        </CardHeader>

        <CardBody className="flex flex-col gap-4 pt-0">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              as={Link}
              href="/"
              color="primary"
              variant="solid"
              size="lg"
              radius="full"
            >
              Retour a l&apos;accueil
            </Button>
            <Button
              as={Link}
              href="/contact"
              color="primary"
              variant="flat"
              size="lg"
              radius="full"
            >
              Nous contacter
            </Button>
          </div>

          <div className="mx-auto mt-2 flex max-w-xl flex-wrap items-center justify-center gap-2">
            {brandConfig.menu.map((item) => (
              <Button
                key={item.href}
                as={Link}
                href={item.href}
                size="sm"
                variant="light"
                color="default"
                radius="full"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

export default NotFound;
