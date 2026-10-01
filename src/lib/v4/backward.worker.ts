// Backward strict hors du fil principal : la recherche exhaustive (jusqu'à
// 10⁶ évaluations du moteur) ne fige jamais l'écran.
import { backwardSmallestChange } from "./decision-express";
import type { AtelierSession } from "./atelier-store";

self.onmessage = (e: MessageEvent<{ id: number; session: AtelierSession }>) => {
  let last = 0;
  // Avancement : étape de la programmation dynamique / nombre d'étapes (au plus 10 messages par seconde).
  const onProgress = (done: number, total: number) => {
    const now = Date.now();
    if (now - last < 100) return;
    last = now;
    (self as unknown as Worker).postMessage({ id: e.data.id, progress: done / Math.max(1, total) });
  };
  const result = backwardSmallestChange(e.data.session, { onProgress });
  (self as unknown as Worker).postMessage({ id: e.data.id, result });
};
