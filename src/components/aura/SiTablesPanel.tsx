// SiTablesPanel.tsx — échantillons SI sous forme de tableau : les données
// réellement retournées par une source (colonnes = métadonnées de la table,
// lignes = enregistrements renvoyés par l'API), avec le mapping porté par
// chaque colonne (ex. Client.ville) quand il existe.
//
// Aucune ligne n'est fabriquée : si la source ne répond pas ou si la table est
// vide, on affiche l'erreur telle quelle. Chaque colonne peut être déclarée
// comme champ source en un clic — ses vraies valeurs alimentent alors le
// moteur de rapprochement d'Ontology Mapping.
import { useState } from "react";
import type { ArgusVocab, SiTableSnapshot, AppField } from "../../lib/v4/argus-vocab-store";
import { queryLiveSiRows } from "../../lib/v4/si-connector";

const ACCENT = "#6C5CE7";
const inputStyle: React.CSSProperties = { padding: "7px 9px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13.5, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" };

export function SiTablesPanel({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const liveApps = vocab.apps.filter(a => a.liveEndpoint && a.enabled !== false);
  const [appId, setAppId] = useState(liveApps[0]?.id ?? "");
  const [table, setTable] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshots = vocab.siTables ?? [];

  async function fetchTable() {
    const app = vocab.apps.find(a => a.id === appId);
    if (!app?.liveEndpoint || !table.trim()) return;
    setLoading(true); setError(null);
    const r = await queryLiveSiRows({ data: { endpoint: app.liveEndpoint, table: table.trim() } });
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    const snap: SiTableSnapshot = {
      id: crypto.randomUUID(), appId: app.id, table: table.trim(),
      columns: r.columns, rows: r.rows, fetchedAt: new Date().toISOString(),
    };
    onUpdate({ ...vocab, siTables: [...snapshots.filter(s => !(s.appId === app.id && s.table === snap.table)), snap] });
    setTable("");
  }

  function removeSnapshot(id: string) {
    onUpdate({ ...vocab, siTables: snapshots.filter(s => s.id !== id) });
  }

  function fieldFor(snap: SiTableSnapshot, column: string): AppField | undefined {
    const target = `${snap.table}.${column}`.toLowerCase();
    return vocab.fields.find(f => f.appId === snap.appId && (f.name.toLowerCase() === target || f.name.toLowerCase() === column.toLowerCase()));
  }

  function mappingLabel(field: AppField | undefined): string | null {
    if (!field) return null;
    const link = (vocab.entityMappings ?? []).find(l => l.fieldId === field.id);
    if (!link) return null;
    const entity = (vocab.entities ?? []).find(e => e.id === link.entityId);
    const attr = entity?.attributes.find(a => a.id === link.attributeId);
    return entity && attr ? `${entity.name}.${attr.name}` : null;
  }

  function declareField(snap: SiTableSnapshot, column: string) {
    if (fieldFor(snap, column)) return;
    const values = snap.rows.map(r => r[column]).filter(v => v && v.trim()).slice(0, 6);
    const field: AppField = { id: crypto.randomUUID(), appId: snap.appId, name: `${snap.table}.${column}`, sampleValues: values, liveTable: snap.table };
    onUpdate({ ...vocab, fields: [...vocab.fields, field] });
  }

  if (liveApps.length === 0 && snapshots.length === 0) {
    return (
      <div style={{ fontSize: 13.5, color: "var(--v4-text3)", lineHeight: 1.6 }}>
        Aucune application n'a de connexion réelle configurée. Renseignez un endpoint joignable dans
        {" "}« Applications &amp; connexions » pour lire de vraies tables ici — aucune donnée n'est simulée.
      </div>
    );
  }

  return (
    <div>
      {liveApps.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "var(--v4-bg)", marginBottom: 14 }}>
        <select value={appId} onChange={e => setAppId(e.target.value)} style={inputStyle}>
          {liveApps.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <input value={table} onChange={e => setTable(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchTable(); }}
          placeholder="Table / route (ex. customers)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <button onClick={fetchTable} disabled={!table.trim() || loading}
          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: table.trim() ? ACCENT : "var(--v4-border)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: table.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
          {loading ? "…" : "Lire la table"}
        </button>
      </div>}
      {error && <div style={{ fontSize: 13.5, color: "#B45309", marginBottom: 12.5 }}>{error}</div>}

      {snapshots.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucune table lue pour l'instant.</div>}

      {snapshots.map(snap => {
        const app = vocab.apps.find(a => a.id === snap.appId);
        return (
          <div key={snap.id} style={{ border: "1px solid var(--v4-border)", borderRadius: 8, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--v4-bg)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>{app?.label ?? "?"}</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: ACCENT }}>/api/{snap.table}</span>
              <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>{snap.rows.length} lignes · lu le {new Date(snap.fetchedAt).toLocaleString()}</span>
              <button onClick={() => removeSnapshot(snap.id)} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14 }}>×</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
                <thead>
                  <tr>
                    {snap.columns.map(c => {
                      const field = fieldFor(snap, c);
                      const label = mappingLabel(field);
                      return (
                        <th key={c} style={{ textAlign: "left", padding: "7px 10px", borderBottom: "1px solid var(--v4-border)", whiteSpace: "nowrap", verticalAlign: "top" }}>
                          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{c}</div>
                          {label
                            ? <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", marginTop: 2 }}>→ {label}</div>
                            : field
                              ? <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 2 }}>champ déclaré · non branché</div>
                              : <button onClick={() => declareField(snap, c)}
                                  style={{ marginTop: 2, fontSize: 12.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, border: `1px dashed ${ACCENT}`, background: "transparent", color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>
                                  + déclarer
                                </button>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {snap.rows.slice(0, 12).map((row, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--v4-border)" }}>
                      {snap.columns.map(c => (
                        <td key={c} style={{ padding: "6px 10px", color: "var(--v4-text2)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
