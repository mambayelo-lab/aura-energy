// Protocoles réalistes par type d'outil : ce que chaque famille d'applications
// expose réellement sur le marché (documentation publique des éditeurs types,
// sources dans docs/INTEGRATION-DONNEES.md). Le premier protocole est le
// protocole natif le plus courant, proposé par défaut par le Studio. ESB et MCP
// sont des passerelles transverses, possibles pour tout outil.
// Ce tableau est le même que celui du SI de démonstration Maison Lucie
// (lib/channels.js, PROTOCOLS) : une application n'y répond que sur ces canaux.
import type { ConnectorKind } from "./types";

export interface ToolProtocols {
  id: string;
  label: string;
  /** Éditeurs types (exemples, pour reconnaître l'outil). */
  examples: string;
  /** Protocoles exposés, le natif en premier. */
  kinds: ConnectorKind[];
  /** Ce qui reste à confirmer avec le client ou l'éditeur. */
  aConfirmer?: string;
  /** Reconnaissance par nom d'application ou type déclaré. */
  match: RegExp;
}

export const TRANSVERSE_KINDS: ConnectorKind[] = ["esb", "mcp"];

export const TOOL_PROTOCOLS: ToolProtocols[] = [
  { id: "erp", label: "ERP", examples: "SAP S/4HANA, SAP ECC", kinds: ["odata", "odata4", "rfc", "idoc", "soap", "edifact", "x12", "as2"], match: /\berp\b|sap s\/?4|s\/4hana|\becc\b|sap(?!.*(successfactors|ariba|ewm|tm\b))/i,
    aConfirmer: "EDI (EDIFACT, X12, AS2) passe en général par le traducteur EDI du client, pas par l'ERP seul." },
  { id: "pim", label: "PIM", examples: "Akeneo, Salsify", kinds: ["rest", "sftp"], match: /\bpim\b|akeneo|salsify/i },
  { id: "wms", label: "WMS", examples: "Manhattan Active WM, Reflex, SAP EWM", kinds: ["manhattan", "rest", "soap", "sftp", "mq", "amqp"], match: /\bwms\b|manhattan|reflex|\bewm\b|entrep[oô]t/i,
    aConfirmer: "SOAP et files de messages (IBM MQ, RabbitMQ) selon l'éditeur et l'intergiciel du client ; IDoc seulement pour SAP EWM." },
  { id: "tms", label: "TMS", examples: "Blue Yonder TMS, SAP TM", kinds: ["rest", "edifact", "x12", "as2", "sftp", "mq", "amqp"], match: /\btms\b|transport|blue ?yonder/i,
    aConfirmer: "Files de messages selon l'intergiciel du client." },
  { id: "aps", label: "APS / planification", examples: "Kinaxis Maestro (RapidResponse), o9", kinds: ["rest", "sftp"], match: /\baps\b|kinaxis|rapidresponse|\bo9\b|planif|s&op/i },
  { id: "srm", label: "SRM / achats", examples: "Coupa, SAP Ariba", kinds: ["rest", "soap", "sftp"], match: /\bsrm\b|coupa|ariba|fournisseurs? \(portail\)|portail fournisseur/i,
    aConfirmer: "cXML (commandes et factures) n'est pas lu par Aura ; SOAP pour Ariba, REST (XML ou JSON) pour Coupa." },
  { id: "qms", label: "QMS / qualité", examples: "ETQ, SAP QM, MasterControl", kinds: ["rest", "soap"], match: /\bqms\b|qualit/i,
    aConfirmer: "Protocoles à confirmer selon l'éditeur ; SAP QM expose aussi OData (API_INSPECTIONLOT_SRV)." },
  { id: "oms", label: "OMS / e-commerce", examples: "Salesforce Commerce et Order Management, Shopify", kinds: ["rest", "graphql", "cloudevents", "salesforce", "grpcweb"], match: /\boms\b|commerce|shopify|salesforce|e-?commerce|commandes? clients?/i,
    aConfirmer: "gRPC : l'API Pub/Sub de Salesforce est en gRPC ; Shopify n'en expose pas." },
  { id: "rh", label: "SIRH", examples: "Workday, SAP SuccessFactors", kinds: ["soap", "rest", "odata4", "sftp"], match: /\bsirh\b|\brh\b|\bhr\b|workday|successfactors/i,
    aConfirmer: "SuccessFactors : OData v2 surtout, v4 pour une partie des API ; Workday : SOAP (le plus complet) et REST." },
  { id: "lac", label: "Lac de données / entrepôt", examples: "Snowflake, Databricks", kinds: ["sqlhttp", "sql", "rest", "file", "sftp", "kafka", "cdc"], match: /\blac\b|lake|snowflake|databricks|entrep[oô]t de donn[ée]es|warehouse|bigquery/i },
];

/** Type d'outil reconnu d'après le nom de l'application ou son type déclaré. */
export function toolOf(name: string, type = ""): ToolProtocols | undefined {
  const s = `${name} ${type}`;
  // Ordre : les noms les plus spécifiques d'abord (SuccessFactors avant SAP, Salesforce avant ERP…).
  const order = ["rh", "srm", "oms", "wms", "tms", "aps", "pim", "qms", "lac", "erp"];
  return order.map(id => TOOL_PROTOCOLS.find(t => t.id === id)!).find(t => t.match.test(s));
}
/** Protocoles possibles pour un outil (natifs puis passerelles) ; tous si l'outil n'est pas reconnu. */
export function kindsFor(tool: ToolProtocols | undefined): ConnectorKind[] | null {
  return tool ? [...tool.kinds, ...TRANSVERSE_KINDS] : null;
}
/** Protocole natif proposé par défaut. */
export const nativeKind = (tool: ToolProtocols | undefined): ConnectorKind | undefined => tool?.kinds[0];
/** Le protocole déclaré est-il réaliste pour cet outil ? (true si outil inconnu : pas d'avis) */
export function kindRealistic(kind: ConnectorKind, tool: ToolProtocols | undefined): boolean {
  const k = kindsFor(tool);
  if (!k) return true;
  // REST générique et « manhattan » (REST paginé) sont équivalents ; OData v2 compte comme REST pour un SIRH SuccessFactors.
  return k.includes(kind) || (kind === "rest" && k.includes("manhattan")) || (kind === "manhattan" && k.includes("rest"));
}
