// Traduction de l'interface en anglais, au rendu : quand la langue est « en »,
// chaque texte visible (nœuds texte, info-bulles, textes indicatifs, libellés
// d'accessibilité) est traduit par un dictionnaire de phrases (i18n-en) et des
// motifs pour les textes dynamiques (nombres, noms d'options). Les données
// saisies par l'utilisateur ne sont jamais modifiées (champs de saisie).
// La même fonction sert aux rapports PDF, à l'export comité et aux e-mails.
import { EN_PHRASES, EN_PATTERNS, EN_WORDS } from "./i18n-en";

export type UiLang = "fr" | "en";

export function currentLang(): UiLang {
  try { return localStorage.getItem("aura.lang") === "en" ? "en" : "fr"; } catch { return "fr"; }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Traduit une phrase connue, un motif ou une suite de segments connus ; null sinon. */
export function translatePhrase(input: string): string | null {
  const t = norm(input);
  if (!t) return null;
  const hit = EN_PHRASES[t];
  if (hit !== undefined) return hit;
  for (const [re, f] of EN_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    const r = f(m, translateOrKeep);
    if (r !== null) return r; // null : motif sans traduction, on essaie le suivant
  }
  // Segments séparés par « · », « — », « : », « | » : chacun doit être connu.
  for (const sep of [" · ", " — ", " : ", " | ", " → ", ", "]) {
    if (!t.includes(sep)) continue;
    const parts = t.split(sep);
    const tr = parts.map(p => (p.trim() && p.trim() !== "…" ? translatePhrase(p) ?? (EN_WORDS[p.trim()] ?? (/^[\d\s.,%€+\-−–()/]+$/.test(p) || isProperName(p) ? p : null)) : p));
    if (tr.every(x => x !== null)) return tr.join(sep === " : " ? ": " : sep);
  }
  const w = EN_WORDS[t];
  return w ?? null;
}

/** Nom propre, code ou identifiant (SUP-001, SAP, Maison Lucie…) : laissé tel quel. */
function isProperName(p: string): boolean {
  const s = p.trim();
  return /^[A-Z0-9][A-Z0-9_.\-/ ]*$/.test(s) || /^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/.test(s) && !EN_PHRASES[s];
}

export function translateOrKeep(s: string): string {
  return translatePhrase(s) ?? s;
}

/** Pour les rapports et e-mails : traduit si la langue est l'anglais. */
export function tr(s: string, lang: UiLang = currentLang()): string {
  if (lang !== "en") return s;
  // Préserve les retours à la ligne : traduit ligne par ligne.
  return s.split("\n").map(line => {
    const lead = line.match(/^\s*/)?.[0] ?? "";
    const trail = line.match(/\s*$/)?.[0] ?? "";
    const x = translatePhrase(line);
    return x === null ? line : lead + x + trail;
  }).join("\n");
}

// ── Traduction du DOM ───────────────────────────────────────────────────────
const ATTRS = ["title", "placeholder", "aria-label"];
const SKIP = "script,style,textarea,input,select option[data-user],[data-no-translate],code,pre";

function translateTextNode(n: Text) {
  const p = n.parentElement;
  if (!p || p.closest(SKIP)) return;
  const raw = n.textContent ?? "";
  if (!/[A-Za-zÀ-ÿ]/.test(raw)) return;
  const x = translatePhrase(raw);
  if (x === null || x === norm(raw)) return;
  const lead = raw.match(/^\s*/)?.[0] ?? "", trail = raw.match(/\s*$/)?.[0] ?? "";
  n.textContent = lead + x + trail;
}
function translateAttrs(el: Element) {
  if (el.closest("[data-no-translate]")) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) continue;
    const x = translatePhrase(v);
    if (x !== null && x !== v) el.setAttribute(a, x);
  }
}
function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root as Text); return; }
  if (!(root instanceof Element)) return;
  translateAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n as Text);
    else translateAttrs(n as Element);
  }
}

/** Démarre la traduction continue du document ; renvoie la fonction d'arrêt. */
export function startDomTranslation(): () => void {
  if (typeof document === "undefined") return () => {};
  translateTree(document.body);
  let pending = new Set<Node>();
  let scheduled = false;
  const flush = () => { scheduled = false; const nodes = pending; pending = new Set(); nodes.forEach(translateTree); };
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "characterData") pending.add(m.target);
      else if (m.type === "attributes") pending.add(m.target);
      else m.addedNodes.forEach(x => pending.add(x));
    }
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return () => obs.disconnect();
}
