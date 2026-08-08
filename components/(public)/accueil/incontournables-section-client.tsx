'use client';

// components/(public)/accueil/incontournables-section-client.tsx
//
// Les produits vedettes de l'accueil sont COMMANDABLES. Auparavant leur bouton
// « Je commande » ouvrait WhatsApp avec un message pré-rempli : le client
// quittait le site et le panier applicatif ne voyait jamais rien passer. Ils
// passent maintenant par `useQuickAdd`, le même geste que la carte — modale
// pour un produit à options, ajout direct sinon.
//
// L'accusé de réception est l'icône panier de la navbar, qui apparaît en
// animation avec le compteur et le montant (`NavbarCartButton`, actif partout
// sauf sur /carte*). Pas de bouton flottant ici : il ferait doublon.

import React from 'react';
import dynamic from 'next/dynamic';
import { Button, Card, CardBody, CardFooter, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';

import { priceFormatter, type Product } from '@/config/menu';
import { useQuickAdd } from '@/components/(public)/carte/_components/use-quick-add';
import {
  ProductBadge,
  ProductMedia,
  productBadgeLabel,
} from '@/components/(public)/carte/_components/product-media';

const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

type Props = {
  items: Product[];
};

function FeaturedCard({ product }: { product: Product }) {
  const { hasOptions, justAdded, isModalOpen, closeModal, handleAdd } =
    useQuickAdd(product);
  const badge = productBadgeLabel(product);

  return (
    <>
      <Card
        className="group h-full overflow-hidden border border-default-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        shadow="none"
      >
        <div className="relative h-72 w-full overflow-hidden md:h-80">
          <ProductMedia
            product={product}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
            monogramClassName="text-6xl"
          />
        </div>

        <CardBody className="gap-2 px-5 py-4">
          {/* Badge dans le bloc texte et non en overlay : voir la note de
              `ProductBadge` — sur la photo il masquait le produit et sa
              lisibilité dépendait du visuel dessous. */}
          {badge && <ProductBadge label={badge} className="mb-1 self-start" />}
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-foreground/70">{product.description}</p>
          <p className="mt-1 text-base font-semibold text-primary">
            {priceFormatter.format(product.price)}
            <span className="ml-1 text-xs font-medium text-foreground/60">
              FCFA
            </span>
          </p>
        </CardBody>

        <CardFooter className="px-5 pb-5 pt-0">
          <Button
            color={justAdded ? 'success' : 'primary'}
            variant="solid"
            className="w-full font-medium"
            onPress={handleAdd}
            startContent={
              justAdded ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )
            }
            aria-label={
              hasOptions
                ? `Choisir les options de ${product.name}`
                : `Ajouter ${product.name} au panier`
            }
          >
            {justAdded ? 'Ajouté' : 'Ajouter'}
          </Button>
        </CardFooter>
      </Card>

      {hasOptions && (
        <SupplementModal
          product={product}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
}

function IncontournablesSectionClient({ items }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="bg-background py-14 md:py-20"
      aria-labelledby="incontournables-title"
    >
      <div className="content-container px-6">
        <motion.div
          className="mb-8 flex flex-col gap-3 md:mb-10"
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Les favoris EBA
          </p>
          <h2
            id="incontournables-title"
            className="text-3xl font-bold sm:text-4xl"
          >
            Ce qu’on aime vous servir
          </h2>
          <p className="max-w-2xl text-sm text-foreground/75 md:text-base">
            Les pâtisseries et boissons les plus aimées par nos habitués,
            préparées chaque matin à Cocody.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product, index) => (
            <motion.div
              key={product.id}
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.6,
                ease: 'easeOut',
                delay: index * 0.1,
              }}
              className="h-full"
            >
              <FeaturedCard product={product} />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-10 flex justify-center"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Button
            as={Link}
            href="/carte"
            color="primary"
            variant="bordered"
            size="lg"
            className="font-medium"
          >
            Voir toute la carte
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default IncontournablesSectionClient;
