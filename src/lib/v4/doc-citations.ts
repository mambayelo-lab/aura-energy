// Documents joints au dialogue « Décider vite » : ce qui en est repris est toujours
// une citation littérale d'un extrait, avec son fichier. Rien n'est inventé :
// une citation proposée par le modèle de langage qui ne figure pas mot pour mot
// dans le document est écartée.


export interface DialogueDoc { name: string; text: string }
export interface Citation { extrait: string; fichier: string; usage: string }

const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const fold = (s: string) => flat(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOP = new Set(["avec", "pour", "dans", "sans", "notre", "nous", "vous", "votre", "leur", "plus", "moins", "entre", "cette", "quel", "quelle", "faut", "doit", "sont", "avant", "apres", "depuis", "which", "with", "from", "that", "this", "their"]);
const words = (s: string) => new Set(fold(s).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(w => w.length > 3 && !STOP.has(w)));

/** Contexte documentaire envoyé au modèle (borné). */
export function docsContext(docs: DialogueDoc[], max = 6000): string {
  const per = Math.max(800, Math.floor(max / Math.max(1, docs.length)));
  return docs.map(d => `[${d.name}]\n${flat(d.text).slice(0, per)}`).join("\n\n").slice(0, max);
}

/** Garde les citations littérales (extrait présent dans le fichier cité), 5 au plus. */
export function sanitizeCitations(raw: unknown, docs: DialogueDoc[]): Citation[] {
  if (!Array.isArray(raw)) return [];
  const out: Citation[] = [];
  for (const c of raw as Partial<Citation>[]) {
    const extrait = flat(String(c?.extrait ?? "")).replace(/^[«"“]\s*|\s*[»"”]$/g, "");
    if (extrait.length < 12) continue;
    const doc = docs.find(d => d.name === c?.fichier && fold(d.text).includes(fold(extrait))) ?? docs.find(d => fold(d.text).includes(fold(extrait)));
    if (!doc || out.some(o => o.extrait === extrait)) continue;
    out.push({ extrait: extrait.slice(0, 280), fichier: doc.name, usage: flat(String(c?.usage ?? "")).slice(0, 200) || "contexte de la décision" });
    if (out.length >= 5) break;
  }
  return out;
}

/** Sans modèle de langage : phrases du document les plus proches de la question, citées telles quelles. */
export function fallbackCitations(question: string, docs: DialogueDoc[], n = 3): Citation[] {
  const q = words(question);
  const scored: { c: Citation; s: number }[] = [];
  for (const d of docs) {
    for (const sentence of flat(d.text).split(/(?<=[.!?;])\s+|\n+/)) {
      const t = sentence.trim();
      if (t.length < 20 || t.length > 280) continue;
      const w = words(t);
      const common = [...w].filter(x => q.has(x));
      const s = common.length * 2 + (/\d/.test(t) ? 1 : 0);
      if (s < 2) continue;
      scored.push({ s, c: { extrait: t, fichier: d.name, usage: common.length ? `rejoint la question (${common.slice(0, 3).join(", ")})` : "fait chiffré du document" } });
    }
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, n).map(x => x.c);
}
