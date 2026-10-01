// Fichiers : S3, SFTP, dossier de dépôt ; CSV et Parquet (colonnaire, partitionné).
// Lus par DuckDB : filtres et agrégats poussés dans le lecteur Parquet
// (projection, élagage de partitions Hive, statistiques de groupes de lignes).
import { SqlConnector, type SqlDriverFactory } from "./sql";
import type { ConnectorDeps } from "./base";
import type { SourceConfig } from "../types";

export interface FileEntity { path: string; format: "parquet" | "csv"; key?: string; watermark?: string; hive?: boolean }

export function fileViewSql(name: string, e: FileEntity): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Nom d'entité refusé : ${name}`);
  if (/^sftp:\/\//i.test(e.path)) throw new Error("SFTP : Aura ne se connecte pas en SFTP. Synchroniser d'abord vers un dossier de dépôt ou un compartiment S3 (rclone, lftp), puis déclarer ce chemin.");
  const p = e.path.replace(/'/g, "''");
  const reader = e.format === "parquet" ? `read_parquet('${p}', hive_partitioning = ${e.hive ? "true" : "false"}, union_by_name = true)` : `read_csv_auto('${p}', header = true)`;
  return `CREATE OR REPLACE VIEW "${name}" AS SELECT * FROM ${reader}`;
}

export class FileConnector extends SqlConnector {
  override readonly kind = "file" as const;
  constructor(config: SourceConfig, deps: ConnectorDeps, duckdb: SqlDriverFactory) {
    const entities = (config.params.entities ?? {}) as Record<string, FileEntity>;
    super({ ...config, params: { ...config.params, dialect: "duckdb", entities: Object.fromEntries(Object.entries(entities).map(([k, e]) => [k, { table: k, key: e.key, watermark: e.watermark }])) } }, deps, async p => {
      const init: string[] = [];
      if (Object.values(entities).some(e => /^s3:\/\//.test(e.path))) {
        init.push("INSTALL httpfs", "LOAD httpfs");
        if (p.s3KeyId) init.push(`CREATE OR REPLACE SECRET s3src (TYPE s3, KEY_ID '${String(p.s3KeyId).replace(/'/g, "''")}', SECRET '${String(p.s3Secret ?? "").replace(/'/g, "''")}', REGION '${String(p.s3Region ?? "eu-west-3").replace(/'/g, "''")}')`);
      }
      for (const [k, e] of Object.entries(entities)) init.push(fileViewSql(k, e));
      return duckdb({ ...p, database: ":memory:", init });
    });
  }
}
