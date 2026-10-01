// Encart discret « Pourquoi cette recommandation est solide » et bouton
// « Mini-rapport PDF » (enregistré et rattaché à la décision). Ce que Décider
// fait et que les outils classiques ne font pas : évaluations qualitatives
// d'experts sans poids arbitraires, attitude prudente, toutes les combinaisons
// explorées, plus petit changement, preuve et trace de la décision.
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { AtelierSession } from "../../../lib/v4/atelier-store";
import { solidity, type Solidity } from "../../../lib/v4/mini-report";
import { audit, useAccess } from "../../../lib/security/use-access";

const CSS = `
.sn{border:1px solid #d9d6f5;border-radius:10px;background:#fbfbff;margin:10px 0;font-size:12.5px;color:#3b3f68}
.sn>summary{cursor:pointer;list-style:none;display:flex;gap:6px;align-items:center;padding:8px 12px;font-weight:700;color:#1a1433}
.sn>summary::-webkit-details-marker{display:none}
.sn ul{margin:0;padding:0 14px 10px 30px;line-height:1.55}
.sn b{color:#1a1433}
.mr-msg{font-size:12px;margin:4px 0 0;color:#0d7a54}.mr-msg.local{color:#8a5a00}
`;
export function SolidityList({ s }: { s: Solidity }) {
  return (
    <ul>
      <li><b>Évaluations d'experts, sans poids arbitraires</b> : {s.evaluations} évaluations qualitatives (de « forte dégradation » à « forte amélioration »), dont {s.judged} confirmées ; aucun coefficient numérique inventé.</li>
      <li><b>Attitude {s.attitude.split(" :")[0]}</b>{s.attitude.includes(":") ? ` : ${s.attitude.split(": ")[1]}` : ""}.</li>
      <li><b>Toutes les combinaisons explorées</b> : {s.combinations.toLocaleString("fr-FR")} combinaisons de leviers{s.exhaustive ? ", sans échantillonnage" : " (budget d'exploration atteint)"}.</li>
      <li><b>Plus petit changement</b> : {s.smallestChange}</li>
      <li><b>Preuve et trace</b> : {s.trace.join(" · ")}.</li>
    </ul>
  );
}
export function SolidityNote({ session }: { session: AtelierSession }) {
  const s = useMemo(() => solidity(session), [session]);
  return (
    <details className="sn" data-testid="solidity-note">
      <style>{CSS}</style>
      <summary><ShieldCheck size={14} /> Pourquoi cette recommandation est solide</summary>
      <SolidityList s={s} />
    </details>
  );
}

export function MiniReportButton({ session, className = "dp-ghost", style }: { session: AtelierSession; className?: string; style?: React.CSSProperties }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; local: boolean } | null>(null);
  const access = useAccess();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
      <style>{CSS}</style>
      <button type="button" className={className} style={style} data-testid="mini-report-pdf" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        try {
          const { miniReport, miniReportPdf, saveMiniReport } = await import("../../../lib/v4/mini-report");
          const author = access.email ?? (access.demo ? "utilisateur de démonstration" : "utilisateur");
          const bytes = await miniReportPdf(miniReport(session, author));
          const saved = await saveMiniReport(session, bytes, author);
          audit("export", "mini-rapport de décision (PDF)");
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
          const a = document.createElement("a"); a.href = url; a.download = `mini-rapport-${(session.title || "decision").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50)}.pdf`; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          setMsg({ text: saved.message, local: saved.where === "local" });
        } catch (e) { setMsg({ text: `Mini-rapport non enregistré : ${(e as Error).message}`, local: true }); }
        finally { setBusy(false); }
      }}>{busy ? "Mini-rapport…" : "Mini-rapport PDF"}</button>
      {msg && <span role="status" className={`mr-msg${msg.local ? " local" : ""}`} data-testid="mini-report-message">{msg.text}</span>}
    </span>
  );
}
