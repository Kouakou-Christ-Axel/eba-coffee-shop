import type { SoldOutLine } from '@/lib/schemas/order';

export class AdvanceOrderRequiredError extends Error {
  constructor(public readonly requiredDays: number) {
    super(
      `Cet article doit être commandé au moins ${requiredDays} jour(s) à l'avance.`
    );
    this.name = 'AdvanceOrderRequiredError';
  }
}

export class ScheduleUnavailableError extends Error {
  constructor(public readonly productName: string) {
    super(`${productName} n'est pas disponible à cette date.`);
    this.name = 'ScheduleUnavailableError';
  }
}

export class SoldOutTodayError extends Error {
  /** Noms dédoublonnés (une ligne par variante de goûts partage le nom). */
  public readonly productNames: string[];

  constructor(public readonly lines: SoldOutLine[]) {
    const productNames = [...new Set(lines.map((l) => l.productName))];
    super(
      `${productNames.join(', ')} : épuisé aujourd’hui. Choisissez un retrait à partir de demain.`
    );
    this.name = 'SoldOutTodayError';
    this.productNames = productNames;
  }
}
