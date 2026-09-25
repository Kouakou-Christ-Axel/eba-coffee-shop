// lib/restock-alert-rate-limit.ts
//
// Anti-abus de `/api/menu/alertes` (inscription aux alertes « de retour ») :
// clé = IP, même limite connue que lib/rate-limit.ts (mémoire du process). Le
// plafond par appareil (`RESTOCK_ALERT_MAX_PER_ENDPOINT`) reste le vrai
// garde-fou sur le volume stocké.

import { createRateLimiter } from './rate-limit';

export const allowRestockAlert = createRateLimiter(10 * 60_000, 30);
