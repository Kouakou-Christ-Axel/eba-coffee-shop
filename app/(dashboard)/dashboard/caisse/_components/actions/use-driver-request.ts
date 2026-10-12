'use client';

import { callApi } from './call-api';

/** Pose le drapeau partagé « livreur demandé » (visible cuisine + caisse). */
export function useDriverRequest(
  orderId: string,
  runMutation: (key: string, fn: () => Promise<void>) => void,
  setActionError: (error: string | null) => void
) {
  function handleRequestDriver() {
    setActionError(null);
    runMutation('driver-request', async () => {
      const result = await callApi(
        `/api/caisse/orders/${orderId}/driver-request`,
        'PATCH',
        { requested: true }
      );
      // 409 « État déjà à jour » : la cuisine l'a déjà posé, rien à signaler.
      if (!result.ok && !result.error.includes('déjà')) {
        setActionError(result.error);
      }
    });
  }
  return { handleRequestDriver };
}
