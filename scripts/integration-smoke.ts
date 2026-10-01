// Parcours complet : questionnaire Maison Lucie → import → métadonnées/échantillons → correspondances → synchronisation.
import { importQuestionnaire, maisonLucieExample } from "../src/lib/integration/questionnaire";
import { discoverSetup, syncSetup } from "../src/lib/integration/runtime.server";
import { resetGovernors } from "../src/lib/integration/budget";

const base = process.argv[2] ?? "http://localhost:3300";
resetGovernors();
const setup = importQuestionnaire(maisonLucieExample(base), { tokenRef: () => "{{env:LUCIE_GATEWAY_TOKEN}}" });
console.log("import", setup.summary, setup.issues.map(i => i.message));
const d = await discoverSetup(setup);
for (const [k, p] of Object.entries(d.profiles)) console.log("profil", k, p.metadata, p.columns.length, p.error ?? "");
console.log("proposées", d.proposals.filter(p => p.status === "validée").length, "à valider", d.proposals.filter(p => p.status === "à valider").map(p => `${p.attributeId}→${p.column} ${p.score}`));
setup.proposals = d.proposals.map(p => (p.status === "à valider" ? { ...p, status: "validée" as const } : p));
const t0 = Date.now();
const s = await syncSetup("smoke", setup, "full", "2026-09-28");
console.log("sync ms", Date.now() - t0);
for (const r of s.runs) console.log(r.sourceId.padEnd(22), r.step.padEnd(24), `${r.durationMs}ms`, "lu", r.rowsRead, "appels", r.calls, r.error ?? "");
for (const r of s.reports) console.log(r.system.padEnd(40), `${r.pct}%`, "orph", r.orphans.length, "dup", r.duplicates.length, "confl", r.conflicts.length, "attente", r.pendingReview);
for (const a of s.alerts) console.log(a.severity, a.label, JSON.stringify(a.evidence.values));
console.log("écarts", s.divergenceCount, s.divergences.filter(x => x.kind === "fond").slice(0, 5).map(x => `${x.attribute} ${x.master.value} ≠ ${x.others.map(o => `${o.system}:${o.value}`).join(",")}`));
const s2 = await syncSetup("smoke", setup, "incremental", "2026-09-28");
console.log("incr", s2.runs.filter(r => r.mode === "incremental").map(r => `${r.step}:${r.rowsRead}/${r.calls}${r.error ? " ERR " + r.error : ""}`).join(" | "));
