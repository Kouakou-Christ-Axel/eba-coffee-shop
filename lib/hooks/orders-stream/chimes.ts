export function playNewOrderChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  // Deux répétitions d'un aller-retour à deux notes (sirène), séparées par un
  // blanc plus long — reconnaissable sans regarder l'écran.
  const HIGH = 1318.51; // mi6
  const LOW = 1046.5; // do6
  const beat = 0.13;
  const gap = 0.03;
  const notes: Array<{ freq: number; start: number; duration: number }> = [];
  let t = 0;
  for (let rep = 0; rep < 2; rep++) {
    for (const freq of [LOW, HIGH, LOW, HIGH]) {
      notes.push({ freq, start: t, duration: beat });
      t += beat + gap;
    }
    t += 0.22; // blanc entre les deux répétitions
  }
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = now + note.start;
    const endAt = startAt + note.duration;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.45, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.start(startAt);
    osc.stop(endAt + 0.05);
  }
  setTimeout(() => ctx.close(), 2200);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

export function playReadyChime() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes: Array<{ freq: number; start: number; duration: number }> = [
    { freq: 523.25, start: 0, duration: 0.14 }, // do
    { freq: 659.25, start: 0.14, duration: 0.14 }, // mi
    { freq: 783.99, start: 0.28, duration: 0.14 }, // sol
    { freq: 1046.5, start: 0.42, duration: 0.32 }, // do aigu
  ];
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = now + note.start;
    const endAt = startAt + note.duration;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.start(startAt);
    osc.stop(endAt + 0.05);
  }
  setTimeout(() => ctx.close(), 1500);
}
