// Persistance des images uploadées (dashboard multipart, MCP base64, URL distante). Implémentation dans `lib/uploads/`.

export { uploadsBaseDir } from './uploads/paths';
export type { UploadSubdir } from './uploads/paths';
export { saveImage, saveImageFromBase64 } from './uploads/save';
export { saveImageFromUrl } from './uploads/remote';
export {
  saveProductImage,
  saveProductImageFromBase64,
  saveProductImageFromUrl,
  saveReceiptImage,
  saveReceiptImageFromBase64,
  saveReceiptImageFromUrl,
  savePollOptionImage,
  savePollOptionImageFromBase64,
  savePollOptionImageFromUrl,
  savePollSuggestionImage,
  savePollImage,
  savePollImageFromBase64,
  savePollImageFromUrl,
  saveTiktokThumbnailFromUrl,
} from './uploads/presets';
