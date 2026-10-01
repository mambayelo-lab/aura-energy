// Connecteur Héliade Énergies (SI fictif, lecture seule).
// Lit GET {VITE_HELIADE_URL}/api/aura/snapshot ; à défaut (pas d'URL, réseau
// indisponible), repli sur l'instantané embarqué heliade-snapshot.json,
// exporté du dépôt mambayelo-lab/heliade-energies-si. Aucune écriture.
import embedded from "./heliade-snapshot.json";

type Num = number | null | undefined;
export type HeliadeSnapshot = {
  fictional: boolean; source: string; snapshotAt: string;
  referentiel: { assets: { assetId: string; nom: string; pays: string; filiere: string; puissanceMW: number; energieMWh?: number; centre: string }[]; crosswalk: { assetId: string; gmaoFunctionalLocation: string; scadaTag: string; statutRapprochement: string; ecart?: string }[] };
  planification: { schedules: { programmeId: string; assetId: string; marche: string; type?: string; puissanceMW: number; capaciteDisponibleLueMW?: Num; conflitIndisponibilite?: string | null; socRequisPct?: Num; debut: string; fin: string }[] };
  orchestrateur: { setpoints: { consigneId: string; assetId: string; valeurMW: number; acquittement: string; ageS: number; delaiAcquittementMaxS: number; ecartConsigneTelemesureLuMW: number; toleranceMW: number; limiteLocaleLueMW?: Num; sourceLimiteLocale?: string }[] };
  "temps-reel": { telemetry: { assetId: string; puissanceMW: Num; socPct?: Num; qualite: string; dureeSansVariationMin?: Num; seuilGelMin?: Num; controlable: boolean }[] };
  remit: { umm: { indispoId: string; assetId: string; statut: string; echeanceDepassee: boolean; retardLuMin: number; echeancePublication: string }[] };
  "scada-pays": { links: { lienId: string; pays: string; etat: string; modeDegrade: boolean; actifsConcernes?: string[] }[] };
  [tool: string]: unknown;
};

export const HELIADE_DEMO_TOKEN = "heliade_aura_gateway_demo_token"; // jeton de démonstration public
export const EMBEDDED_SNAPSHOT = embedded as unknown as HeliadeSnapshot;

export type HeliadeRead = { snapshot: HeliadeSnapshot; mode: "live" | "embarqué"; url?: string };

export async function readHeliade(baseUrl = (import.meta as { env?: Record<string, string> }).env?.VITE_HELIADE_URL): Promise<HeliadeRead> {
  if (!baseUrl) return { snapshot: EMBEDDED_SNAPSHOT, mode: "embarqué" };
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/api/aura/snapshot`, { headers: { Authorization: `Bearer ${HELIADE_DEMO_TOKEN}` } });
    if (!r.ok) throw new Error(String(r.status));
    return { snapshot: (await r.json()) as HeliadeSnapshot, mode: "live", url: baseUrl };
  } catch {
    return { snapshot: EMBEDDED_SNAPSHOT, mode: "embarqué" };
  }
}

/** Protocoles par outil Héliade (pour Studio / documentation d'intégration). */
export const HELIADE_PROTOCOLS: Record<string, string> = {
  referentiel: "REST /api/tools/referentiel · MCP get_dataset", planification: "REST · Kafka heliade.planification.schedules (AsyncAPI)",
  orchestrateur: "REST · Kafka heliade.orchestrateur.setpoints", "temps-reel": "MQTT heliade/{pays}/{actif}/telemetry · REST",
  indisponibilites: "REST", historian: "OPC UA (passerelle REST /opcua/read)", "scada-pays": "IEC 60870-5-104 (passerelle REST /iec104/{lien})",
  tso: "SOAP 1.1 /tso/soap", "journal-quart": "REST", gmao: "REST", "monitoring-reseau": "REST · MQTT", remit: "REST",
};
