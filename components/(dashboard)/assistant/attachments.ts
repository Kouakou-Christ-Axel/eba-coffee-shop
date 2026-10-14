// Préparation des fichiers joints côté navigateur : les photos sont
// redimensionnées/recompressées (une photo de téléphone dépasse vite la limite
// de corps de requête), les PDF sont envoyés tels quels sous un plafond.

import { MAX_ATTACHMENTS } from '@/lib/ai/assistant/types';

export { MAX_ATTACHMENTS };
export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const IMAGE_MAX_SIDE = 1600;
const IMAGE_QUALITY = 0.82;
const PDF_MAX_BYTES = 2_500_000;

export type Attachment = {
  name: string;
  kind: 'image' | 'pdf';
  /** data URL prêt à envoyer. */
  dataUrl: string;
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(
      `« ${file.name} » : image illisible (utilisez JPEG, PNG ou WebP)`
    );
  }
  const scale = Math.min(
    1,
    IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, 'image/jpeg', IMAGE_QUALITY)
  );
  if (!blob) throw new Error(`« ${file.name} » : compression impossible`);
  return readAsDataUrl(blob);
}

export async function prepareAttachment(file: File): Promise<Attachment> {
  if (file.type === 'application/pdf') {
    if (file.size > PDF_MAX_BYTES) {
      throw new Error(`« ${file.name} » : PDF trop lourd (max 2,5 Mo)`);
    }
    return { name: file.name, kind: 'pdf', dataUrl: await readAsDataUrl(file) };
  }
  if (file.type.startsWith('image/')) {
    return {
      name: file.name,
      kind: 'image',
      dataUrl: await compressImage(file),
    };
  }
  throw new Error(`« ${file.name} » : format non supporté (image ou PDF)`);
}
