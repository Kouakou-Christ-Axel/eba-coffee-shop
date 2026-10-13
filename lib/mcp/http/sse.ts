/**
 * Flux SSE vide pour GET : serveur sans état, mais les clients exigent que le
 * flux EXISTE (un 405 fait échouer la connexion). Maintenu par keep-alive.
 */
export function sseStream(): Response {
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': open\n\n'));
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          // Flux déjà fermé : on ignore.
        }
      }, 25000);
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // Empêche nginx de bufferiser le flux SSE.
      'X-Accel-Buffering': 'no',
    },
  });
}
