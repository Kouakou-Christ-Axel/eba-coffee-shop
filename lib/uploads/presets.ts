import { saveImage, saveImageFromBase64 } from './save';
import { saveImageFromUrl } from './remote';

/** Image produit (multipart dashboard). */
export const saveProductImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'products');

/** Image produit depuis base64 (MCP). */
export const saveProductImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'products', mimeType);

/** Image produit rapatriée depuis une URL distante (MCP). */
export const saveProductImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'products');

/** Justificatif de dépense (multipart dashboard). */
export const saveReceiptImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'receipts');

/** Justificatif de dépense depuis base64 (MCP). */
export const saveReceiptImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'receipts', mimeType);

/** Justificatif de dépense/apport rapatrié depuis une URL distante (MCP). */
export const saveReceiptImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'receipts');

/** Image d'une option de sondage (multipart dashboard). */
export const savePollOptionImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'poll-options');

/** Image d'une option de sondage depuis base64 (MCP). */
export const savePollOptionImageFromBase64 = (
  input: string,
  mimeType?: string
) => saveImageFromBase64(input, 'poll-options', mimeType);

/** Image d'une option de sondage rapatriée depuis une URL distante (MCP). */
export const savePollOptionImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'poll-options');

export const savePollSuggestionImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'poll-options');

/** Image de couverture d'un sondage (multipart dashboard). */
export const savePollImage = (buffer: Buffer, mimeType: string) =>
  saveImage(buffer, mimeType, 'polls');

/** Image de couverture d'un sondage depuis base64 (MCP). */
export const savePollImageFromBase64 = (input: string, mimeType?: string) =>
  saveImageFromBase64(input, 'polls', mimeType);

/** Image de couverture d'un sondage rapatriée depuis une URL distante (MCP). */
export const savePollImageFromUrl = (url: string) =>
  saveImageFromUrl(url, 'polls');

export const saveTiktokThumbnailFromUrl = (url: string) =>
  saveImageFromUrl(url, 'tiktok');
