// Vue Résilience : délai de survie (TTS) et délai de reprise (TTR) par nœud,
// LUS dans le SI (APS) par site, nœuds critiques (TTR lu > TTS lu), scénario
// d'arrêt qualitatif et maturité. Aura ne calcule rien : il lit et compare.
import { useMemo, useState } from "react";
import { useAccess } from "../../lib/security/use-access";
import type { ArgusVocab } from "../../lib/v4/argus-vocab-store";
import {
  ARRET_KINDS, computeResilience, DETROITS, maturite, NIVEAUX_MATURITE, NON_FOURNI, portsLus, scenarioArret,
  type AggregateNode, type ArretKind, type ArretResult, type ArticleNode,
} from "../../lib/v4/resilience-tts";
import { SUPPLY_PROFILES } from "../../lib/v4/supply-profiles";
import { HYPOTHESES_A_CONFIRMER, RESILIENCE_RULES } from "../../lib/v4/supply-derived";
import { rankPlansB } from "../../lib/v4/plans-b";
import { alertDataMatrix } from "../../lib/v4/alert-data-matrix";
import { solidity } from "../../lib/v4/mini-report";
import { SolidityList } from "./decider/SolidityNote";

/** Règle de résilience dont les options servent de plans B pour chaque type d'arrêt. */
const RULE_OF_ARRET: Record<ArretKind, string> = { detroit: "RES-GEO", fournisseur: "RES-UNIQUE", port: "RES-PORT" };
const PROFIL_OF_ARRET: Record<ArretKind, string> = { detroit: "detroit", fournisseur: "appro", port: "transport" };

export type ResilienceDecision =
  | { kind: "noeud"; article: ArticleNode }
  | { kind: "arret"; result: ArretResult };

const eur = (n?: number) => (n === undefined ? NON_FOURNI : `${Math.round(n).toLocaleString("fr-FR")} €`);
const j = (n?: number) => (n === undefined ? "—" : `${n.toLocaleString("fr-FR")} j`);

export function ResilienceView({ vocab, decisions, rulesTriggered, onOpenDecision }: { vocab: ArgusVocab | undefined; decisions: number; rulesTriggered: number; onOpenDecision: (d: ResilienceDecision) => void }) {
  const access = useAccess();
  const canDecide = access.can("decision.write");
  const res = useMemo(() => computeResilience(vocab), [vocab]);
  const [kind, setKind] = useState<ArretKind>("detroit");
  const [duree, setDuree] = useState(30);
  const [cibleSel, setCible] = useState<string>("");
  const ports = useMemo(() => portsLus(vocab), [vocab]);
  const cibles = kind === "fournisseur" ? res.fournisseurs.map(f => ({ id: f.id, label: f.nom })) : kind === "port" ? ports.map(p => ({ id: p, label: p })) : DETROITS.map(d => ({ id: d.id, label: d.label }));
  const cible = cibles.some(c => c.id === cibleSel) ? cibleSel : cibles[0]?.id ?? "";
  const arret = useMemo(() => res.vide || !cible ? undefined : scenarioArret(res, { kind, cible, dureeJours: duree }, vocab), [res, kind, cible, duree, vocab]);
  // Plans B du type d'arrêt, classés par Décider (Bora : évaluation ordinale, attitude pessimiste).
  const plans = useMemo(() => { const r = RESILIENCE_RULES.find(x => x.id === RULE_OF_ARRET[kind]); if (!r) return undefined; const p = rankPlansB({ id: r.id, label: r.label, options: r.options }); return { ...p, rule: r, solid: solidity(p.session, p.smallestChange) }; }, [kind]);
  const axes = useMemo(() => maturite(vocab, res, decisions, rulesTriggered), [vocab, res, decisions, rulesTriggered]);
  const critiques = res.articles.filter(a => a.critique);
  const matrix = useMemo(() => alertDataMatrix(vocab), [vocab]);

  if (res.vide) return (
    <section className="rs" data-testid="resilience-view">
      <style>{CSS}</style>
      <h2>Exposition : combien de temps tenez-vous si un fournisseur, un port ou un détroit s'arrête ?</h2>
      <p className="rs-empty" data-testid="resilience-empty">Délai de survie et délai de reprise : {NON_FOURNI}. Aura lit ces valeurs dans votre APS ou votre MRP (objet « Position planifiée ») ; il ne les calcule pas. Connectez la source dans le Studio ou chargez la démo Maison Lucie.</p>
    </section>
  );

  const profil = SUPPLY_PROFILES.find(p => p.id === PROFIL_OF_ARRET[kind]);

  return (
    <section className="rs" data-testid="resilience-view">
      <style>{CSS}</style>
      <header className="rs-head">
        <div>
          <h2>Exposition : combien de temps tenez-vous si un fournisseur, un port ou un détroit s'arrête ?</h2>
          <p className="rs-lead">Aura ne calcule rien : il lit, pour chaque article et chaque site, le délai de survie et le délai de reprise fournis par votre SI (APS, MRP), puis applique une règle. Quand il faut plus de temps pour reprendre que pour tenir, l'article est critique : il apparaît aussi comme alerte dans le cockpit, avec son bouton « Décider ».</p>
          <p><b>TTS</b> (délai de survie) et <b>TTR</b> (délai de reprise) : valeurs lues par site. Règle : SI <b>TTR &gt; TTS</b> ALORS le nœud est critique. Le site retenu est celui dont le TTS lu est le plus court.</p>
          <p className="rs-src">Sources : {res.sources.join(" · ")}</p>
        </div>
      </header>
      <p className="rs-src" data-testid="hypotheses-a-confirmer">Seuils des règles (réglables dans le Studio, à confirmer avec le client) : {HYPOTHESES_A_CONFIRMER.join(" · ")}.</p>

      <div className="rs-kpis">
        <div className={critiques.length ? "bad" : "ok"}><b data-testid="resilience-critical-count">{critiques.length}</b><span>nœud(s) critique(s) sur {res.articles.length} références</span></div>
        <div><b>{res.fournisseurs[0]?.nom ?? "—"}</b><span>fournisseur avec le plus de nœuds critiques</span></div>
        <div><b>{res.sites[0]?.nom ?? "—"}</b><span>site avec le plus de nœuds critiques</span></div>
      </div>

      <h3>Carte d'exposition</h3>
      <p className="rs-note">Classement ordinal : nombre de nœuds critiques (TTR lu &gt; TTS lu), puis TTS lu le plus court. Aucun montant calculé.</p>
      <div className="rs-map" data-testid="resilience-map">
        {([["Fournisseurs", res.fournisseurs], ["Sites", res.sites]] as [string, AggregateNode[]][]).map(([t, list]) => (
          <div key={t}>
            <h4>{t}</h4>
            {list.slice(0, 8).map(n => (
              <div key={n.id} className="rs-bar" title={`TTS lu le plus court ${j(n.ttsMin)} · TTR lu le plus long ${j(n.ttrMax)}`}>
                <div className="rs-bar-l"><span>{n.nom}{n.pays ? ` (${n.pays})` : ""}</span>{n.critiques > 0 && <em>{n.critiques} critique{n.critiques > 1 ? "s" : ""}</em>}</div>
                <small>TTS min {j(n.ttsMin)}</small>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h3>Nœuds critiques (TTR lu &gt; TTS lu)</h3>
      {critiques.length === 0 ? <p className="rs-note">Aucun nœud critique avec les valeurs lues.</p> : (
        <div className="rs-scroll"><table className="rs-table" data-testid="resilience-critical">
          <thead><tr><th>Référence</th><th>Fournisseur</th><th>Site</th><th>TTS lu</th><th>TTR lu</th><th>CA à risque lu</th><th /></tr></thead>
          <tbody>{critiques.map(a => (
            <tr key={a.sku}>
              <td><b>{a.designation}</b><br /><small>{a.sku}</small></td>
              <td>{a.fournisseurNom}{a.pays ? ` (${a.pays})` : ""}{a.alternatif ? <><br /><small>alternative : {a.alternatif}</small></> : <><br /><small>aucune alternative</small></>}</td>
              <td>{a.siteCritique ?? "—"}</td>
              <td>{j(a.tts)}</td>
              <td title={a.ttrDetail}>{j(a.ttr)}</td>
              <td>{eur(a.caRisque)}</td>
              <td><button type="button" className="rs-btn" disabled={!canDecide} title={canDecide ? undefined : "Réservé aux analystes et administrateurs"} onClick={() => onOpenDecision({ kind: "noeud", article: a })}>Traiter dans Décider →</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      <h3>Scénario d'arrêt</h3>
      <p className="rs-lead" data-testid="stress-explain">Choisissez un fournisseur, un port ou un détroit et une durée d'arrêt : les règles montrent quels articles rompent avant la fin de l'arrêt, en comparant leur délai de survie lu dans le SI à cette durée, sans calculer aucun montant.</p>
      <div className="rs-stress" data-testid="resilience-stress">
        <div className="rs-controls">
          <label>Arrêt<select value={kind} onChange={e => setKind(e.target.value as ArretKind)} data-testid="stress-scenario">{ARRET_KINDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label>{kind === "fournisseur" ? "Fournisseur" : kind === "port" ? "Port" : "Détroit"}<select value={cible} onChange={e => setCible(e.target.value)} data-testid="stress-cible">{cibles.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label>Durée de l'arrêt<span><input type="number" min={1} max={365} value={duree} onChange={e => setDuree(Math.max(1, Number(e.target.value) || 1))} data-testid="stress-duree" /> j</span></label>
        </div>
        {!cibles.length && <p className="rs-note">{kind === "port" ? `Ports : ${NON_FOURNI} (escales des expéditions).` : NON_FOURNI}</p>}
        {arret && <>
          <p className="rs-note">Règle : {arret.regle} Périmètre : {arret.perimetre}</p>
          <div className="rs-kpis">
            <div className={arret.exposes.length ? "bad" : "ok"}><b data-testid="stress-breaks">{arret.exposes.length}</b><span>article(s) exposé(s) sur {arret.lignes.length} touché(s)</span></div>
            <div><b>{arret.lignes.filter(l => l.statut === "non fourni").length}</b><span>article(s) sans TTS fourni par le SI</span></div>
          </div>
          {arret.lignes.length > 0 && <div className="rs-scroll"><table className="rs-table" data-testid="stress-table">
            <thead><tr><th>Référence</th><th>Fournisseur</th><th>Site le plus exposé</th><th>TTS lu</th><th>Verdict de la règle</th></tr></thead>
            <tbody>{arret.lignes.slice(0, 30).map(l => <tr key={l.article.sku}><td><b>{l.article.designation}</b><br /><small>{l.article.sku}</small></td><td>{l.article.fournisseurNom}{l.article.pays ? ` (${l.article.pays})` : ""}</td><td>{l.article.siteCritique ?? "—"}</td><td>{l.article.tts === undefined ? NON_FOURNI : j(l.article.tts)}</td><td className={l.statut === "exposé" ? "rs-bad" : ""}>{l.statut === "exposé" ? `rompt avant ${duree} j` : l.statut === "tient" ? `tient ${duree} j` : NON_FOURNI}</td></tr>)}</tbody>
          </table></div>}
          {plans && <div className="rs-plans" data-testid="stress-plans-b">
            <h4>Plans B classés par Décider <small>(évaluation ordinale, attitude pessimiste, {plans.combinations.toLocaleString("fr-FR")} combinaisons explorées)</small></h4>
            <ol>{plans.ranking.map(o => <li key={o.id}><b>{o.label}</b> <small>· rang {o.rank}</small></li>)}</ol>
            <details className="rs-solid"><summary>Pourquoi ce classement est solide</summary><SolidityList s={plans.solid} /></details>
          </div>}
          {profil && <div className="rs-levers"><h4>Leviers</h4><ul>{profil.levers.map(l => <li key={l.label}><b>{l.label}</b> : {l.options.slice(1).map(o => o.label).join(" · ")}</li>)}</ul></div>}
          <button type="button" className="rs-btn" disabled={!canDecide} data-testid="stress-decide" onClick={() => onOpenDecision({ kind: "arret", result: arret })}>Traiter ce scénario dans Décider →</button>
        </>}
      </div>

      <h3>Maturité</h3>
      <p className="rs-note">Capacités dynamiques (détecter, décider, reconfigurer), lues sur l'état réel d'Aura et non déclarées. Niveaux : {NIVEAUX_MATURITE.slice(1).join(" → ")}.</p>
      <p className="rs-note" data-testid="maturite-dell">Repère publié, sans lien avec vos données : chez Dell, l'orchestration de bout en bout par l'IA produit plus de 5 000 actions automatisées par trimestre, −50 % de stock vieilli, des décisions 2 fois plus rapides, +5 à 15 % de précision de prévision, −77 % de ruptures de disques durs et plus de 40 % de gains de productivité. La page ne détaille pas les étapes de la feuille de route. Source : <a href="https://digitalsc.mit.edu/dells-digital-supply-chain-transformation/" target="_blank" rel="noreferrer">MIT Digital Supply Chain Transformation Lab, cas Dell</a>.</p>
      <div className="rs-mat" data-testid="resilience-maturite">
        {axes.map(a => <div key={a.id}><span>{a.label}</span><div className="rs-steps">{[1, 2, 3, 4].map(n => <i key={n} className={n <= a.niveau ? "on" : ""} />)}</div><b>{NIVEAUX_MATURITE[a.niveau]}</b><small>{a.preuve}</small></div>)}
      </div>

      <details className="rs-matrix" data-testid="alert-data-matrix">
        <summary>Données par alerte : ce qui est branché, ce qui reste à renseigner</summary>
        <table>
          <thead><tr><th>Alerte</th><th>Données branchées</th><th>À renseigner</th></tr></thead>
          <tbody>{matrix.map(m => <tr key={m.id}><td>{m.label}</td><td>{m.donnees.filter(d => d.statut === "disponible").length}/{m.donnees.length}</td><td>{[...m.donnees.filter(d => d.statut !== "disponible").map(d => `${d.attribut} (${d.source})`), ...m.horsModele.map(h => `${h.donnee} (${h.source})`)].join(" · ") || "—"}</td></tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}

const CSS = `
.rs{display:flex;flex-direction:column;gap:10px;padding:4px 2px 24px;color:var(--v4-text,#1a1433);font-size:13px}
.rs h2{font-size:18px;margin:0 0 4px}.rs h3{font-size:15px;margin:14px 0 0}.rs h4{font-size:13px;margin:0 0 6px;color:var(--v4-text2,#4c3d7a)}
.rs p{margin:0;line-height:1.5}.rs-lead{font-size:14px;margin:4px 0 8px!important}.rs-matrix{margin-top:16px;font-size:12px}.rs-matrix summary{cursor:pointer;font-weight:600}.rs-matrix table{width:100%;border-collapse:collapse;margin-top:8px}.rs-matrix td,.rs-matrix th{border-bottom:1px solid var(--v4-border,#e8e5f8);padding:4px 6px;text-align:left;vertical-align:top}.rs-note,.rs-src{color:var(--v4-text2,#4c3d7a);font-size:12px}
.rs-empty{padding:16px;border:1px dashed var(--v4-border,#e8e5f8);border-radius:10px}
.rs-head{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
.rs-head>div{flex:1 1 420px}
.rs-hyp{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;background:var(--v4-panel,#faf9ff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:8px 10px}
.rs-hyp small{font-weight:400;color:var(--v4-text2,#4c3d7a)}
.rs input,.rs select{padding:4px 6px;border:1px solid var(--v4-border,#e8e5f8);border-radius:6px;font-size:13px;background:var(--v4-surface,#fff);color:inherit}
.rs input[type=number]{width:70px}
.rs-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.rs-kpis>div{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.rs-kpis b{font-size:18px}.rs-kpis span{font-size:12px;color:var(--v4-text2,#4c3d7a)}
.rs-kpis .bad b{color:#b91c1c}.rs-kpis .ok b{color:#047857}
.rs-map{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.rs-map>div{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:10px 12px}
.rs-bad{color:#b91c1c;font-weight:700}
.rs-bar{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:8px;align-items:center;padding:3px 0}
.rs-bar-l{display:flex;flex-direction:column;min-width:0}.rs-bar-l span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-bar-l em{font-style:normal;font-size:12px;color:#b91c1c;font-weight:700}
.rs-bar-t{height:8px;background:var(--v4-panel,#f3f1fd);border-radius:4px;overflow:hidden}.rs-bar-t i{display:block;height:100%;background:#a5b4fc}.rs-bar-t i.hot{background:#ef4444}
.rs-bar small{font-size:12px;color:var(--v4-text2,#4c3d7a);white-space:nowrap}
.rs-scroll{overflow-x:auto}
.rs-table{width:100%;border-collapse:collapse;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px}
.rs-table th{text-align:left;background:var(--v4-panel,#faf9ff);font-weight:800;padding:7px 9px;border-bottom:1px solid var(--v4-border,#e8e5f8);font-size:12px}
.rs-table td{padding:7px 9px;border-bottom:1px solid var(--v4-border,#e8e5f8);vertical-align:top}
.rs-table small{font-size:12px;color:var(--v4-text2,#4c3d7a)}.rs-tbc{color:#b45309!important}
.rs-btn{background:var(--v4-accent,#6d28d9);color:#fff;border:0;border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
.rs-btn:disabled{opacity:.5;cursor:not-allowed}
.rs-stress{display:flex;flex-direction:column;gap:8px;background:var(--v4-panel,#faf9ff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:10px 12px}
.rs-stress .rs-btn{align-self:flex-start}
.rs-controls{display:flex;gap:12px;flex-wrap:wrap}.rs-controls label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700}
.rs-facts,.rs-levers ul{margin:0;padding-left:18px;line-height:1.6}
.rs-plans{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:8px 12px}
.rs-plans ol{margin:0;padding-left:20px;line-height:1.6}.rs-plans small{font-weight:400;color:var(--v4-text2,#4c3d7a)}
.rs-solid summary{cursor:pointer;font-weight:700;font-size:12px;margin-top:4px}.rs-solid ul{margin:4px 0 0;padding-left:18px;line-height:1.5;font-size:12px}
.rs-mat{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.rs-mat>div{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.rs-mat span{font-weight:800}.rs-mat small{font-size:12px;color:var(--v4-text2,#4c3d7a)}
.rs-steps{display:flex;gap:4px}.rs-steps i{flex:1;height:6px;border-radius:3px;background:var(--v4-border,#e8e5f8)}.rs-steps i.on{background:#6d28d9}
`;
