// AuraMark.tsx — identité Aura (logo 2026 : trois pans indigo/marine + « AURA »).
// Le signe est redessiné en SVG à partir du fichier fourni (formes simples,
// net à toute taille) ; le mot « AURA » reprend l'image fournie.

import React from "react";

const INDIGO = "#4743E6";
const NAVY = "#151D52";

function MarkSvg({ height, title }: { height: number; title?: string }) {
  return (
    <svg viewBox="500 134 553 532" height={height} width={Math.round(height * 553 / 532)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ display: "block", flexShrink: 0 }}>
      <polygon fill={INDIGO} points="505,448 663,332 663,551 505,666" />
      <polygon fill={INDIGO} points="699,233 832,139 832,533 767,482 699,532" />
      <polygon fill={NAVY} points="861,300 991,407 1048,660 861,660" />
    </svg>
  );
}

/** Logo horizontal : signe + mot « AURA ». */
export function AuraArtwork({ height = 36, title = "Aura", className }: { height?: number; title?: string; className?: string }) {
  const markH = Math.round(height * 0.92);
  const wordH = Math.round(height * 0.5);
  return (
    <span className={["aura-official-artwork", className].filter(Boolean).join(" ")} role="img" aria-label={title}
      style={{ display: "inline-flex", alignItems: "flex-end", gap: Math.round(height * 0.22), height, flexShrink: 0 }}>
      <MarkSvg height={markH} />
      <img src="/aura-wordmark.png" alt="" aria-hidden="true" draggable={false} style={{ height: wordH, width: "auto", marginBottom: Math.round(height * 0.04), userSelect: "none" }} />
    </span>
  );
}

/** Signe seul, pour les petits emplacements. */
export function AuraMark({ size = 28, title = "Aura" }: { size?: number; mono?: boolean; color?: string; title?: string }) {
  return <span className="aura-official-mark" style={{ display: "inline-flex", flexShrink: 0 }}><MarkSvg height={size} title={title} /></span>;
}
