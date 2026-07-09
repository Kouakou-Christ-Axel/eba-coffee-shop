// lib/cloudinary-client.ts
//
// Upload direct NAVIGATEUR → Cloudinary : le fichier ne transite jamais par
// notre serveur. On récupère d'abord une signature auprès d'une route
// `.../sign` (rôle/état métier vérifiés côté serveur), puis on poste le
// fichier directement à `api.cloudinary.com` avec ces paramètres signés.
//
// Client only — à importer uniquement depuis des composants 'use client'.

import type { SignedUploadParams } from '@/lib/cloudinary';

async function fetchSignature(
  signEndpoint: string,
  signBody?: Record<string, string>
): Promise<SignedUploadParams> {
  const res = await fetch(signEndpoint, {
    method: 'POST',
    headers: signBody ? { 'Content-Type': 'application/json' } : undefined,
    body: signBody ? JSON.stringify(signBody) : undefined,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erreur ${res.status}`);
  }
  return res.json();
}

/**
 * Uploade `file` directement vers Cloudinary. `signEndpoint` est la route
 * `.../sign` qui autorise et signe l'upload ; `signBody` porte les paramètres
 * nécessaires à cette autorisation (ex. `{ subdir: 'polls' }`). Renvoie
 * l'URL de livraison Cloudinary (`secure_url`).
 */
export async function uploadToCloudinary(
  file: File,
  signEndpoint: string,
  signBody?: Record<string, string>
): Promise<string> {
  const params = await fetchSignature(signEndpoint, signBody);

  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', params.api_key);
  fd.append('timestamp', String(params.timestamp));
  fd.append('folder', params.folder);
  fd.append('transformation', params.transformation);
  fd.append('allowed_formats', params.allowed_formats);
  fd.append('signature', params.signature);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${params.cloud_name}/image/upload`,
    { method: 'POST', body: fd }
  );
  if (!uploadRes.ok) {
    const j = (await uploadRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      j.error?.message ?? `Échec upload Cloudinary (${uploadRes.status})`
    );
  }
  const { secure_url: secureUrl } = (await uploadRes.json()) as {
    secure_url: string;
  };
  return secureUrl;
}

/**
 * Confirme une image déjà uploadée vers Cloudinary auprès d'une route
 * publique en capability-URL (`.../preuve-paiement`, `.../photo`) : ces
 * routes persistent l'URL en base après re-vérification de l'état métier
 * (commande/suggestion toujours éligible), au lieu de recevoir directement
 * le fichier.
 */
export async function confirmCloudinaryUrl(
  confirmEndpoint: string,
  url: string
): Promise<void> {
  const res = await fetch(confirmEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erreur ${res.status}`);
  }
}
