// Liens de contact externes (tel:, wa.me, Wave) et messages WhatsApp : construction d'URL uniquement. Implémentation dans `lib/contact-links/`.

export {
  buildTelLink,
  buildWhatsAppLink,
  buildWhatsAppShareLink,
  buildWaveLink,
} from './contact-links/links';
export {
  buildWaveRequestMessage,
  buildPaymentReminderMessage,
} from './contact-links/payment-messages';
export {
  buildPickupReadyMessage,
  buildFeedbackMessage,
  buildTrackingShareMessage,
} from './contact-links/order-messages';
export {
  buildDriverRequestMessage,
  buildDriverShareMessage,
} from './contact-links/driver-messages';
