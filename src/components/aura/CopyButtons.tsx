import { useState } from "react";

/** Retire la syntaxe Markdown courante pour une copie en texte brut. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "");
}

/** Boutons « Copier » et « Copier en Markdown » sous un message LLM. */
export function CopyButtons({ text }: { text: string }) {
  const [done, setDone] = useState<"" | "txt" | "md">("");
  const copy = async (kind: "txt" | "md") => {
    try { await navigator.clipboard.writeText(kind === "md" ? text : stripMarkdown(text)); setDone(kind); setTimeout(() => setDone(""), 1500); } catch { /* presse-papiers indisponible */ }
  };
  const st = { fontSize: 11, padding: "1px 6px", border: "1px solid var(--border, #ccc)", borderRadius: 4, background: "transparent", cursor: "pointer", color: "inherit" } as const;
  return (
    <div className="copy-btns" style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
      <button type="button" style={st} data-testid="copy-text" onClick={() => copy("txt")}>{done === "txt" ? "Copié ✓" : "Copier"}</button>
      <button type="button" style={st} data-testid="copy-md" onClick={() => copy("md")}>{done === "md" ? "Copié ✓" : "Copier en Markdown"}</button>
    </div>
  );
}
