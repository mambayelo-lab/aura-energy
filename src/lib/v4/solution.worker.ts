// Exploration des solutions hors du fil principal (jusqu'à 10⁶ évaluations).
import { exploreAll } from "./solution.worker-core";
import type { AtelierSession } from "./atelier-store";

self.onmessage = (e: MessageEvent<AtelierSession>) => {
  (self as unknown as Worker).postMessage(exploreAll(e.data));
};
