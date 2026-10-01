import { governorFor, type SourceGovernor } from "../budget";
import type { Connector, SourceConfig } from "../types";
import type { FetchLike } from "./base";
import { ODataConnector } from "./odata";
import { KafkaRestConnector, ManhattanConnector, RestConnector } from "./rest";
import { SqlConnector, type SqlDriverFactory } from "./sql";
import { FileConnector } from "./files";
import { AmqpConnector, As2Connector, CdcConnector, CloudEventsConnector, EdifactConnector, EsbConnector, GraphQLConnector, GrpcWebConnector, IdocConnector, MqConnector, OData4Connector, RfcConnector, SalesforceConnector, SftpConnector, SoapConnector, SqlHttpConnector, X12Connector } from "./channels";
import { McpConnector } from "./mcp";

export interface Factories { sqlDriver?: (dialect: string) => SqlDriverFactory; fetch?: FetchLike; env?: Record<string, string | undefined>; governor?: SourceGovernor }

/** Crée le connecteur d'une source ; tous ses appels passent par le gouverneur (budget) de la source. */
export function createConnector(config: SourceConfig, f: Factories = {}): Connector & { close(): Promise<void>; calls: number } {
  const deps = { governor: f.governor ?? governorFor(config.id, config.budget), fetch: f.fetch, env: f.env };
  switch (config.kind) {
    case "odata": return new ODataConnector(config, deps);
    case "manhattan": return new ManhattanConnector(config, deps);
    case "rest": return new RestConnector(config, deps);
    case "kafka": return new KafkaRestConnector(config, deps);
    case "sql": {
      if (!f.sqlDriver) throw new Error("Pilote SQL indisponible dans ce contexte (serveur uniquement).");
      return new SqlConnector(config, deps, f.sqlDriver(String(config.params.dialect ?? "postgres")));
    }
    case "odata4": return new OData4Connector(config, deps);
    case "graphql": return new GraphQLConnector(config, deps);
    case "soap": return new SoapConnector(config, deps);
    case "salesforce": return new SalesforceConnector(config, deps);
    case "amqp": return new AmqpConnector(config, deps);
    case "mq": return new MqConnector(config, deps);
    case "cloudevents": return new CloudEventsConnector(config, deps);
    case "cdc": return new CdcConnector(config, deps);
    case "sftp": return new SftpConnector(config, deps, f.sqlDriver?.("duckdb"));
    case "sqlhttp": return new SqlHttpConnector(config, deps);
    case "grpcweb": return new GrpcWebConnector(config, deps);
    case "esb": return new EsbConnector(config, deps);
    case "idoc": return new IdocConnector(config, deps);
    case "rfc": return new RfcConnector(config, deps);
    case "edifact": return new EdifactConnector(config, deps);
    case "x12": return new X12Connector(config, deps);
    case "as2": return new As2Connector(config, deps);
    case "mcp": return new McpConnector(config, deps);
    case "file": {
      if (!f.sqlDriver) throw new Error("Lecteur de fichiers indisponible dans ce contexte (serveur uniquement).");
      return new FileConnector(config, deps, f.sqlDriver("duckdb"));
    }
  }
}

export { SAP_TEMPLATES } from "./odata";

export { McpConnector } from "./mcp";
