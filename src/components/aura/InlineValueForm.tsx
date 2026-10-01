// Petit formulaire dans le fil d'un dialogue (copilote Supply, « Décider
// vite ») : quand la réponse attendue est une valeur (seuil, montant, date,
// nom d'option, pondération), un champ pré-rempli se valide d'un clic ou
// avec Entrée. Le format et l'unité sont vérifiés avant l'envoi.
import { useState } from "react";

export type InlineField =
  | { key: string; label: string; kind: "number"; unit?: string; default?: number; min?: number; max?: number }
  | { key: string; label: string; kind: "date"; default?: string }
  | { key: string; label: string; kind: "text"; default?: string; placeholder?: string }
  | { key: string; label: string; kind: "weight"; default?: "N" | "L" | "M" | "H" };

export type InlineValues = Record<string, string | number>;

/** Lit un nombre saisi à la française (« 1 234,5 », « 12 % », « 3 jours ») ; vérifie l'unité si elle est tapée. */
export function parseNumber(raw: string, unit?: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = raw.trim().replace(/ /g, " ");
  const m = t.match(/^(-?[\d\s]*[.,]?\d+)\s*(.*)$/);
  if (!m) return { ok: false, error: "Nombre attendu" };
  const value = Number(m[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(value)) return { ok: false, error: "Nombre attendu" };
  const typed = m[2].trim().toLowerCase();
  if (typed && unit) {
    const u = unit.trim().toLowerCase();
    const same = typed === u || typed.replace(/s$/, "") === u.replace(/s$/, "") || (u === "%" && typed === "pourcent");
    if (!same) return { ok: false, error: `Unité attendue : ${unit}` };
  } else if (typed && !unit) return { ok: false, error: "Nombre sans unité attendu" };
  return { ok: true, value };
}

/** Date au format JJ/MM/AAAA ou AAAA-MM-JJ → AAAA-MM-JJ. */
export function parseDate(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  let y: number, mo: number, d: number;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return { ok: false, error: "Date attendue (JJ/MM/AAAA)" };
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { ok: false, error: "Date invalide" };
  return { ok: true, value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

const WEIGHTS = [["N", "NUL"], ["L", "Faible"], ["M", "Moyen"], ["H", "Élevé"]] as const;

export function InlineValueForm({ fields, onSubmit, submitLabel = "✓", validate, testId = "inline-form" }: {
  fields: InlineField[]; onSubmit: (v: InlineValues) => void; submitLabel?: string;
  validate?: (v: InlineValues) => string | null; testId?: string;
}) {
  const [raw, setRaw] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.key, f.default !== undefined ? String(f.kind === "number" && typeof f.default === "number" ? f.default.toLocaleString("fr-FR") : f.default) : ""])));
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const out: InlineValues = {};
    for (const f of fields) {
      const r = raw[f.key] ?? "";
      if (f.kind === "number") {
        const p = parseNumber(r, f.unit);
        if (!p.ok) return setError(`${f.label} : ${p.error}`);
        if (f.min !== undefined && p.value < f.min) return setError(`${f.label} : au moins ${f.min}`);
        if (f.max !== undefined && p.value > f.max) return setError(`${f.label} : au plus ${f.max}`);
        out[f.key] = p.value;
      } else if (f.kind === "date") {
        const p = parseDate(r);
        if (!p.ok) return setError(`${f.label} : ${p.error}`);
        out[f.key] = p.value;
      } else if (f.kind === "text") {
        if (!r.trim()) return setError(`${f.label} : à renseigner`);
        out[f.key] = r.trim();
      } else out[f.key] = r || "M";
    }
    const e = validate?.(out) ?? null;
    if (e) return setError(e);
    setError(null);
    onSubmit(out);
  };
  return (
    <form className="ivf" data-testid={testId} onSubmit={e => { e.preventDefault(); submit(); }} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", margin: "6px 0" }}>
      {fields.map(f => (
        <label key={f.key} style={{ display: "grid", gap: 3, fontSize: 12, color: "#4c3d7a" }}>
          {f.label}
          {f.kind === "weight" ? (
            <span role="radiogroup" aria-label={f.label} style={{ display: "inline-flex", border: "1px solid #d9d6f5", borderRadius: 8, overflow: "hidden" }}>
              {WEIGHTS.map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={(raw[f.key] || f.default) === v} onClick={() => setRaw(r => ({ ...r, [f.key]: v }))}
                  style={{ padding: "5px 9px", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: (raw[f.key] || f.default) === v ? "#4743E6" : "#fff", color: (raw[f.key] || f.default) === v ? "#fff" : "#3b3f68" }}>{l}</button>
              ))}
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input aria-label={f.label} value={raw[f.key] ?? ""} placeholder={f.kind === "date" ? "JJ/MM/AAAA" : f.kind === "text" ? f.placeholder : undefined}
                inputMode={f.kind === "number" ? "decimal" : undefined}
                onChange={e => { setRaw(r => ({ ...r, [f.key]: e.target.value })); setError(null); }}
                style={{ width: f.kind === "text" ? 200 : 110, padding: "6px 8px", borderRadius: 8, border: `1px solid ${error?.startsWith(f.label) ? "#c0392b" : "#d9d6f5"}`, fontSize: 13.5, fontFamily: "inherit" }} />
              {f.kind === "number" && f.unit && <span style={{ fontSize: 12.5, color: "#6b6f93" }}>{f.unit}</span>}
            </span>
          )}
        </label>
      ))}
      <button type="submit" aria-label="Valider" style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#4743E6", color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{submitLabel}</button>
      {error && <span role="alert" style={{ flexBasis: "100%", fontSize: 12.5, color: "#c0392b" }}>{error}</span>}
    </form>
  );
}
