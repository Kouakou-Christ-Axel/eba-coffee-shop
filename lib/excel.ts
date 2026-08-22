// lib/excel.ts
//
// Réponse HTTP de téléchargement .xlsx, partagée par tous les modules qui
// construisent des classeurs Excel (lib/inventory-excel.ts, lib/stats-excel.ts).

export function xlsxResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
