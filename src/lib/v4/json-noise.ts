// Nettoyage des écarts de syntaxe fréquents des réponses LLM autour d'un JSON :
// blocs de commentaires /* … */ et // … (les gabarits de prompt en contiennent,
// le modèle les recopie) puis virgules traînantes. Sans ce nettoyage, un modèle
// pourtant complet était rejeté par JSON.parse
// (« Expected double-quoted property name in JSON at position … »).
export function stripJsonNoise(s: string): string {
  let out = "";
  let inString = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === "/" && s[i + 1] === "*") { const end = s.indexOf("*/", i + 2); i = end < 0 ? s.length : end + 1; continue; }
    if (c === "/" && s[i + 1] === "/") { const end = s.indexOf("\n", i + 2); i = end < 0 ? s.length : end; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}
