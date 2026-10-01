// DocumentDrop.tsx — import de documents, partout où Aura pose des questions.
// Le texte extrait est rendu à la page hôte, qui décide seule de ce qu'elle en
// fait (contexte de cadrage, vocabulaire métier, description d'une source…).
// Aucune donnée n'est inventée : ce qui est affiché vient du document.

import React, { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { DOC_ACCEPT, DOC_FORMATS_LABEL as FORMATS } from "../../lib/v4/doc-formats";
import type { DocResult } from "../../lib/v4/doc-extract";

/** Formats acceptés, affichés discrètement sous chaque contrôle d'import. */
export const DOC_FORMATS_LABEL = FORMATS;

/**
 * Glisser-déposer générique : transfère les fichiers déposés sur l'<input
 * type="file"> contenu dans la zone et déclenche son onChange habituel.
 */
export function dropFilesToInput(e: React.DragEvent<HTMLElement>) {
  e.preventDefault();
  const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input || !e.dataTransfer?.files?.length || input.disabled) return;
  input.files = e.dataTransfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Propriétés de zone de dépôt (survol visuel via data-drag). */
export function dropZoneProps() {
  return {
    onDragOver: (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); e.currentTarget.dataset.drag = "true"; },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => { e.currentTarget.dataset.drag = "false"; },
    onDrop: (e: React.DragEvent<HTMLElement>) => { e.currentTarget.dataset.drag = "false"; dropFilesToInput(e); },
  };
}

export function DocumentDrop({
  onText,
  label = "Importer un document",
  hint = `Glisser-déposer ou cliquer · ${DOC_FORMATS_LABEL}`,
  compact = false,
}: {
  /** Texte extrait, avec le nom du fichier d'origine. */
  onText: (text: string, fileName: string) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DocResult[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { extractFiles } = await import("../../lib/v4/doc-extract");
      const rs = await extractFiles(Array.from(files), setProgress);
      for (const r of rs) if (r.status !== "non lisible" && r.text.trim()) onText(r.text.trim(), r.name);
      setResults(prev => [...prev, ...rs]);
    } finally {
      setBusy(false); setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label className="aura-doc-drop" data-testid="doc-import" aria-busy={busy}
        style={compact ? { padding: "8px 12px" } : undefined} {...dropZoneProps()}>
        <input ref={inputRef} type="file" multiple hidden disabled={busy}
          accept={DOC_ACCEPT}
          onChange={e => handle(e.target.files)} />
        <span className="aura-icon-pill" style={compact ? { width: 32, height: 32 } : undefined}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        </span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span className="aura-doc-title">{busy ? (progress ?? "Analyse en cours…") : label}</span>
          <span className="aura-doc-formats">{compact ? `Glisser-déposer ou cliquer · ${DOC_FORMATS_LABEL}` : hint}</span>
        </span>
      </label>
      <DocStatusList results={results} />
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = { lu: "#0d7a54", partiel: "#b7791f", "non lisible": "#c0392b" };
/** Liste des fichiers chargés, avec leur état : lu, partiel ou non lisible (et pourquoi). */
export function DocStatusList({ results }: { results: DocResult[] }) {
  if (!results.length) return null;
  return (
    <ul data-testid="doc-status" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 3 }}>
      {results.map((r, i) => (
        <li key={r.name + i} data-status={r.status} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
          {r.preview && <img src={r.preview} alt={`Aperçu de ${r.name}`} data-testid="doc-preview" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid var(--v4-border, #ddd)", flex: "0 0 auto" }} />}
          <span style={{ color: STATUS_COLOR[r.status], fontWeight: 700 }}>{r.status === "non lisible" ? "✕" : "✓ chargé"}</span>
          <b style={{ color: STATUS_COLOR[r.status] }}>{r.status}</b> · <span style={{ overflowWrap: "anywhere" }}>{r.name}</span>{r.note ? <span style={{ color: "var(--v4-text3, #6b6f93)" }}> — {r.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
