'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Field } from './form-field';
import { ProductImagesField } from '../product-images-field';
import type { ProductFormState } from './use-product-form';

export function EssentielTab({ form }: { form: ProductFormState }) {
  const {
    isEdit,
    errors,
    name,
    setName,
    description,
    setDescription,
    price,
    setPrice,
    imageUrl,
    setImageUrl,
    isUploading,
    setIsUploading,
  } = form;
  return (
    <TabsContent value="essentiel" className="space-y-4">
      {/* Création seulement : trois champs suffisent. */}
      {!isEdit && (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          Trois champs suffisent pour créer le produit :{' '}
          <span className="font-medium text-foreground">nom</span>,{' '}
          <span className="font-medium text-foreground">description</span> et{' '}
          <span className="font-medium text-foreground">prix de vente</span>.
          Photo, coûts, suppléments et mise en avant se complètent quand vous
          voulez.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité du produit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="name"
            label="Nom"
            required
            error={errors.name}
            hint={`${name.trim().length}/120`}
            help="Le nom vu par le client sur la carte. Ex. « Café latte »."
          >
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
          <Field
            id="desc"
            label="Description"
            required
            help="Une phrase courte, affichée sous le nom sur la carte."
            error={errors.description}
            hint={`${description.trim().length}/500`}
          >
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(errors.description)}
            />
          </Field>
          <Field
            id="price"
            label="Prix de vente (FCFA)"
            required
            help="Ce que paie le client pour une unité."
            error={errors.price}
          >
            <Input
              id="price"
              type="number"
              min={0}
              step={1}
              placeholder="Ex. 2000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={Boolean(errors.price)}
            />
          </Field>
        </CardContent>
      </Card>

      <ProductImagesField
        imageUrl={imageUrl}
        isUploading={isUploading}
        onUploadStart={() => setIsUploading(true)}
        onUploadEnd={() => setIsUploading(false)}
        onUploaded={setImageUrl}
        onRemove={() => setImageUrl(null)}
      />
    </TabsContent>
  );
}
