// SDK de connecteurs Aura — interface commune.
// Principe : aucune copie brute. Les calculs sont poussés à la source (filtre,
// projection, GROUP BY) ; Aura ne stocke que des référentiels légers, des séries
// d'indicateurs agrégées et des alertes avec leur preuve.

export type Row = Record<string, unknown>;
export type Scalar = string | number | boolean | null;

export type FilterOp = "eq" | "ne" | "gt" | "ge" | "lt" | "le" | "in";
export interface Filter { field: string; op: FilterOp; value: Scalar | Scalar[] }
/** Expression comparant deux ou trois colonnes : a - b < c (ex. OnHand - Allocated < SafetyStock). */
export type ColumnExpr =
  | { kind: "diff_lt"; a: string; b: string; c: string }
  /** Retard : actual > expected, ou actual absent et expected < asOf. */
  | { kind: "late"; actual: string; expected: string; asOf: string };

export type MetricFn = "count" | "sum" | "min" | "max" | "avg" | "count_distinct";
export interface Metric { fn: MetricFn; field?: string; as: string }

export interface QuerySpec {
  entity: string;
  select?: string[];
  filters?: Filter[];
  where?: ColumnExpr[];
  groupBy?: string[];
  metrics?: Metric[];
  orderBy?: { field: string; desc?: boolean }[];
  limit?: number;
}

export interface Pushdown { filter: boolean; select: boolean; aggregate: boolean; limit: boolean; columnExpr: boolean }

export interface QueryResult {
  rows: Row[];
  /** Ce qui a réellement été exécuté par la source (et non en local). */
  pushedDown: { filter: boolean; aggregate: boolean };
  /** Lignes lues côté Aura (après pushdown), appels effectués. */
  rowsRead: number;
  calls: number;
  statement?: string;
}

export interface ColumnInfo { name: string; type: string }
export interface EntityInfo { name: string; columns: ColumnInfo[]; key?: string; watermark?: string; approxRows?: number }
export interface TestResult { ok: boolean; message: string; latencyMs: number }

export interface IncrementalBatch { rows: Row[]; watermark: string | null }

export type ConnectorKind = "sql" | "odata" | "manhattan" | "file" | "rest" | "kafka"
  | "odata4" | "graphql" | "soap" | "salesforce" | "amqp" | "mq" | "cloudevents" | "cdc" | "sftp" | "sqlhttp" | "grpcweb" | "esb"
  | "idoc" | "rfc" | "edifact" | "x12" | "as2" | "mcp";

/** Libellé court de chaque type de connecteur (Studio, santé des sources). */
export const KIND_LABELS: Record<ConnectorKind, string> = {
  sql: "SQL", odata: "SAP OData v2", manhattan: "Manhattan REST", file: "Fichiers", rest: "REST", kafka: "Kafka",
  odata4: "OData v4", graphql: "GraphQL", soap: "SOAP", salesforce: "Salesforce", amqp: "AMQP · RabbitMQ", mq: "IBM MQ",
  cloudevents: "CloudEvents / webhooks", cdc: "CDC (Debezium)", sftp: "SFTP", sqlhttp: "SQL / JDBC (HTTP)", grpcweb: "gRPC-web",
  esb: "ESB / iPaaS", idoc: "SAP IDoc", rfc: "SAP RFC / BAPI", edifact: "EDIFACT", x12: "ANSI X12", as2: "AS2", mcp: "MCP",
};

export interface Connector {
  readonly id: string;
  readonly kind: ConnectorKind;
  readonly pushdown: Pushdown;
  testConnection(): Promise<TestResult>;
  discoverSchema(): Promise<EntityInfo[]>;
  sample(entity: string, n?: number): Promise<Row[]>;
  query(spec: QuerySpec): Promise<QueryResult>;
  /** Lecture incrémentale : lignes dont le watermark est strictement > since. */
  readIncremental(entity: string, watermarkField: string, since: string | null, opts?: { select?: string[]; pageSize?: number }): AsyncIterable<IncrementalBatch>;
}

/** Définition persistée d'une source (aucun secret en clair : références {{env:NOM}}). */
export interface SourceConfig {
  id: string;
  label: string;
  kind: ConnectorKind;
  /** Paramètres de connexion ; les secrets sont des références {{env:NOM}} résolues côté serveur. */
  params: Record<string, unknown>;
  template?: string;
  entities?: Record<string, { key?: string; watermark?: string; objectClass?: ObjectClass }>;
  budget?: Partial<import("./budget").BudgetConfig>;
  /** Mode d'accès, du plus sûr au moins sûr : dépôt, réplique/lac, API directe. */
  accessMode?: AccessMode;
  schedule?: { cron?: string; everyMinutes?: number };
  enabled?: boolean;
  /** Active (défaut), inactive ou obsolète : une source non active n'est plus sollicitée, ses mappings sont suspendus. */
  status?: "active" | "inactive" | "obsolete";
}

/** Classe d'objet → TTL du cache (référentiel 24 h, stock 1 h, expéditions 15 min). */
export type ObjectClass = "master" | "stock" | "shipment" | "order" | "sales" | "default";

export type AccessMode = "depot" | "replica" | "api";
/** Ordre de préférence présenté dans le Studio (le plus sûr d'abord). */
export const ACCESS_MODES: { id: AccessMode; label: string; hint: string; kinds: ConnectorKind[] }[] = [
  { id: "depot", label: "Dépôt", hint: "La source dépose des fichiers ou pousse des événements : Aura ne l'interroge pas.", kinds: ["file", "kafka", "sftp", "amqp", "mq", "cloudevents", "cdc", "idoc", "edifact", "x12", "as2"] },
  { id: "replica", label: "Réplique ou data lake", hint: "Lecture sur une copie, jamais sur la production.", kinds: ["sql", "file", "sqlhttp"] },
  { id: "api", label: "API directe", hint: "En dernier recours : sous budget strict et fenêtres horaires.", kinds: ["odata", "manhattan", "rest", "odata4", "graphql", "soap", "salesforce", "rfc", "grpcweb", "esb", "mcp"] },
];
