import { createFileRoute, Outlet } from "@tanstack/react-router";
import React from "react";
import { GuidedAuraRail } from "@/components/aura/GuidedAuraRail";
import { getAnalyses, onAnalysesChange, deleteAnalyse, type AnalyseEntry } from "../lib/decisionStore";
import { getConnectionState, onConnectionChange, type ConnectionState } from "../lib/connectionStore";


// CockpitShell — layout principal. Ancien menu latéral (Espace Décisionnel,
// Capabilities, Catalogue BC, Argus, Sémantique, MCP…) retiré : il n'était
// plus jamais rendu (variable calculée mais jamais insérée dans le JSX) et
// pointait vers des routes elles-mêmes retirées. Seul /cockpit/home (point
// d'entrée réel) et son outil (/cockpit/atelier)
// restent — ce shell ne fait plus qu'encadrer leur <Outlet/>.
// ─────────────────────────────────────────────────────────────────────────────
function CockpitShell() {
  void getAnalyses; void onAnalysesChange; void getConnectionState; void onConnectionChange;
  return (
    // Colonne : la barre de compte occupe toute la largeur au-dessus du shell.
    // (Auparavant rendue DANS le flex-row `.v4-shell`, elle devenait une
    // colonne et décalait tout le contenu vers la droite.)
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: "100vw" }}>
      <div className="v4-shell" style={{ flex: 1, height: "auto", minHeight: 0 }}>
        <GuidedAuraRail />
        <main className="v4-main" style={{ width: "100%" }}>
          <Outlet />
        </main>
      </div>
      <style>{css}</style>
    </div>
  );
}


// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
/* Thème Aura : violet sur fond clair. Aura n'a pas de bascule sombre dans
   l'interface ; la préférence système et [data-theme] pointent donc vers les
   mêmes valeurs claires, pour qu'aucune page ne passe en fond sombre. */
:root {
  --v4-bg:#f6f5ff; --v4-surface:#ffffff; --v4-border:#e8e5f8; --v4-border2:#d8d3f0;
  --v4-accent:#7c3aed; --v4-accent2:#6d28d9; --v4-accent-bg:#f0ecff; --v4-accent-border:#c9bffd;
  --v4-text:#1a1433; --v4-text1:#1a1433; --v4-text2:#4c3d7a; --v4-text3:#9585c4;
  --v4-panel:#faf9ff;
  --v4-green:#0d7a54; --v4-amber:#a85d0f; --v4-red:#c0392b;
  --v4-green-bg:#ecfdf5; --v4-amber-bg:#fff8ed; --v4-red-bg:#fef2f2;
}
@media (prefers-color-scheme: dark) { :root {
  --v4-bg:#f6f5ff; --v4-surface:#ffffff; --v4-border:#e8e5f8; --v4-border2:#d8d3f0;
  --v4-accent:#7c3aed; --v4-accent2:#6d28d9; --v4-accent-bg:#f0ecff; --v4-accent-border:#c9bffd;
  --v4-text:#1a1433; --v4-text1:#1a1433; --v4-text2:#4c3d7a; --v4-text3:#9585c4;
  --v4-panel:#faf9ff;
  --v4-green:#0d7a54; --v4-amber:#a85d0f; --v4-red:#c0392b;
  --v4-green-bg:#ecfdf5; --v4-amber-bg:#fff8ed; --v4-red-bg:#fef2f2;
}}
:root[data-theme="dark"], :root[data-theme="light"] {
  --v4-bg:#f6f5ff; --v4-surface:#ffffff; --v4-border:#e8e5f8; --v4-border2:#d8d3f0;
  --v4-accent:#7c3aed; --v4-accent2:#6d28d9; --v4-accent-bg:#f0ecff; --v4-accent-border:#c9bffd;
  --v4-text:#1a1433; --v4-text1:#1a1433; --v4-text2:#4c3d7a; --v4-text3:#9585c4;
  --v4-panel:#faf9ff;
  --v4-green:#0d7a54; --v4-amber:#a85d0f; --v4-red:#c0392b;
  --v4-green-bg:#ecfdf5; --v4-amber-bg:#fff8ed; --v4-red-bg:#fef2f2;
}

*, *::before, *::after { box-sizing: border-box; }

.atelier-content { max-width: 1320px !important; }
.exec-view article { border-color: transparent !important; box-shadow: 0 10px 28px rgba(53,55,125,.045) !important; }


.v4-shell {
  display: flex; height: 100vh; overflow: hidden; max-width: 100vw;
  font-family: var(--font-sans);
  font-size: 13px; -webkit-font-smoothing: antialiased;
  font-feature-settings: "kern" 1, "liga" 1;
}
.v4-sidebar {
  width: 210px; flex-shrink: 0; height: 100vh;
  background: var(--v4-surface); border-right: 1px solid var(--v4-border);
  display: flex; flex-direction: column; overflow: hidden;
  transition: width .18s cubic-bezier(.4,0,.2,1);
}
.v4-sidebar-col { width: 46px; }
.v4-main { flex: 1; overflow-y: auto; overflow-x: hidden; min-width: 0; display: flex; flex-direction: column; max-width: 100%; }
.v4-mobile-topbar {
  display: none; align-items: center; justify-content: space-between;
  padding: 10px 16px; background: var(--v4-surface);
  border-bottom: 1px solid var(--v4-border); flex-shrink: 0;
  height: 50px; position: sticky; top: 0; z-index: 40;
}
.v4-hamburger {
  width: 34px; height: 34px; border: none; background: none; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 4px;
}
.v4-hamburger span { display: block; width: 18px; height: 1.5px; background: var(--v4-text3); border-radius: 6px; }
.v4-mobile-brand { display: flex; align-items: center; gap: 8px; }
.v4-mobile-brand-name { font-size: 13px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--v4-accent); }
.v4-drawer {
  position: fixed; top: 0; left: 0; height: 100vh; width: 270px; z-index: 200;
  background: var(--v4-surface); border-right: 1px solid var(--v4-border);
  display: flex; flex-direction: column; overflow: hidden;
  transform: translateX(-100%); transition: transform .2s cubic-bezier(.4,0,.2,1);
}
.v4-drawer-open { transform: translateX(0); }
.v4-drawer-backdrop { position: fixed; inset: 0; z-index: 199; background: rgba(15,12,30,.28); backdrop-filter: blur(2px); }
.v4-brand-mobile { min-height: 52px; }
.v4-drawer-close {
  width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--v4-border);
  background: transparent; color: var(--v4-text3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: inherit;
}
.v4-bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: var(--v4-surface); border-top: 1px solid var(--v4-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.v4-bn-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 3px; padding: 9px 4px 6px; text-decoration: none; color: var(--v4-text3);
  transition: color .1s; -webkit-tap-highlight-color: transparent;
}
.v4-bn-active { color: var(--v4-accent); }
.v4-bn-icon { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; position: relative; }
.v4-bn-label { font-size: 12px; font-weight: 600; letter-spacing: .03em; }
.v4-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 0 12px; border-bottom: 1px solid var(--v4-border);
  flex-shrink: 0; height: 52px; min-height: 52px;
}
.v4-brand-mark {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: var(--v4-accent-bg); border: 1px solid var(--v4-accent-border);
  display: flex; align-items: center; justify-content: center;
}
.v4-brand-name { font-size: 13px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--v4-text); }
.v4-toggle {
  margin-left: auto; flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--v4-border); background: transparent; color: var(--v4-text3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s; font-family: inherit;
}
.v4-toggle:hover { color: var(--v4-accent); border-color: var(--v4-accent-border); background: var(--v4-accent-bg); }
.v4-sidebar-col .v4-toggle { margin-left: 0; }
.v4-sidebar-col .v4-brand { justify-content: center; padding: 0 6px; gap: 0; }
.v4-sidebar-col .v4-brand-mark { width: 32px; height: 32px; }
.v4-group-label {
  font-size: 12px; font-weight: 700; letter-spacing: .12em; color: var(--v4-text3);
  padding: 10px 14px 4px; text-transform: uppercase; overflow: hidden; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
.v4-group-sep { height: 1px; background: var(--v4-border); margin: 8px 12px; }
.v4-navlink {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; margin: 2px 6px; border-radius: 8px;
  color: var(--v4-text2); text-decoration: none;
  transition: color .1s, background .1s;
  white-space: nowrap; overflow: hidden;
  font-family: inherit; -webkit-tap-highlight-color: transparent;
}
.v4-navlink:hover { color: var(--v4-text); background: var(--v4-bg); }
.v4-navlink-active {
  color: var(--item-accent, var(--v4-accent)); font-weight: 600;
  background: color-mix(in srgb, var(--item-accent, var(--v4-accent)) 8%, transparent);
}
.v4-navlink-active:hover { background: color-mix(in srgb, var(--item-accent, var(--v4-accent)) 12%, transparent); }
.v4-navlink-col { padding: 9px 0; margin: 2px 0; justify-content: center; border-radius: 0; }
.v4-navlink-col:hover { background: var(--v4-bg); border-radius: 0; }
.v4-navlink-col.v4-navlink-active { background: var(--v4-accent-bg); border-radius: 0; }
.v4-navlink-primary { padding: 9px 10px; }
.v4-ni { display: flex; align-items: center; justify-content: center; width: 15px; flex-shrink: 0; opacity: .5; }
.v4-navlink:hover .v4-ni, .v4-navlink-active .v4-ni { opacity: 1; }
.v4-nl { flex: 1; min-width: 0; overflow: hidden; line-height: 1; }
.v4-nl-label { display: block; font-size: 13.5px; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; }
.v4-nl-sub { display: block; font-size: 12px; color: var(--v4-text3); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 400; }
.v4-navlink-active .v4-nl-sub { color: color-mix(in srgb, var(--item-accent, var(--v4-accent)) 70%, transparent); }
.v4-badge-dot {
  position: absolute; top: -2px; right: -2px;
  width: 6px; height: 6px; border-radius: 50%;
  border: 1.5px solid var(--v4-surface);
}
.v4-hist-section { margin-top: 2px; }
.v4-count-badge { font-size: 12px; background: var(--v4-accent-bg); color: var(--v4-accent); border-radius: 8px; padding: 1px 6px; font-weight: 700; flex-shrink: 0; }
.v4-hist-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; margin: 0 6px; border-radius: 6px;
  text-decoration: none; color: var(--v4-text2); font-size: 13px; transition: all .1s;
}
.v4-hist-item:hover { background: var(--v4-bg); color: var(--v4-text); }
.v4-hist-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 450; }
.v4-hist-meta { font-size: 12px; color: var(--v4-text3); margin-top: 1px; }
.v4-hist-del { background: none; border: none; cursor: pointer; color: var(--v4-text3); font-size: 13px; padding: 0 2px; line-height: 1; opacity: 0; transition: opacity .1s; font-family: inherit; flex-shrink: 0; }
.v4-hist-item:hover .v4-hist-del { opacity: 0.5; }
.v4-hist-del:hover { opacity: 1 !important; color: var(--v4-red); }
.v4-argus-signal-bar {
  display: flex; align-items: center; gap: 7px;
  margin: 6px 8px 8px; padding: 6px 10px; border-radius: 8px;
  background: #fef3c730; border: 1px solid #f59e0b40;
}
.v4-argus-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; flex-shrink: 0;
  box-shadow: 0 0 0 3px #f59e0b20;
  animation: argus-pulse 2s ease-in-out infinite;
}
@keyframes argus-pulse { 0%,100%{box-shadow:0 0 0 3px #f59e0b20} 50%{box-shadow:0 0 0 5px #f59e0b10} }
.v4-argus-signal-label { font-size: 12px; color: #b45309; font-weight: 600; }
.v4-sidebar-footer {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 6px; border-top: 1px solid var(--v4-border); flex-shrink: 0;
}
.v4-conn-row { display: flex; align-items: center; gap: 7px; padding: 4px 8px; }
.v4-conn-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.v4-conn-label { font-size: 12.5px; color: var(--v4-text3); overflow: hidden; white-space: nowrap; }
.v4-settings-btn {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: var(--v4-text3); cursor: pointer; font-family: inherit; font-size: 13px;
  transition: all .12s; text-align: left;
}
.v4-settings-btn:hover { background: var(--v4-bg); color: var(--v4-text2); border-color: var(--v4-border); }
.v4-settings-btn-active { color: var(--v4-accent); background: var(--v4-accent-bg); border-color: var(--v4-accent-border); }
.v4-settings-btn-open { background: var(--v4-bg); border-color: var(--v4-border); }
.v4-settings-panel {
  position: absolute; bottom: calc(100% + 6px); left: 6px; right: 6px;
  background: var(--v4-surface); border: 1px solid var(--v4-border);
  border-radius: 8px; box-shadow: 0 -8px 24px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06);
  overflow: hidden; z-index: 100;
}
.v4-profile-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; width: 100%; border: none; background: none; cursor: pointer;
  color: var(--v4-text2); transition: background .1s; border-radius: 8px;
  font-family: inherit; text-align: left;
}
.v4-profile-btn:hover { background: var(--v4-bg); color: var(--v4-text); }
.v4-profile-avatar {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: var(--v4-accent-bg); border: 1.5px solid var(--v4-accent-border);
  color: var(--v4-accent); font-size: 12.5px; font-weight: 800; letter-spacing: .02em;
  display: flex; align-items: center; justify-content: center;
}
.v4-profile-avatar-lg { width: 36px; height: 36px; font-size: 13px; }
.v4-profile-info { flex: 1; min-width: 0; overflow: hidden; }
.v4-profile-name { display: block; font-size: 13px; font-weight: 600; color: var(--v4-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v4-profile-role { display: block; font-size: 12px; color: var(--v4-text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v4-profile-panel {
  position: absolute; bottom: calc(100% + 6px); left: 0; width: 220px;
  background: var(--v4-surface); border: 1px solid var(--v4-border);
  border-radius: 8px; box-shadow: 0 -8px 24px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06);
  overflow: hidden;
}
.v4-sidebar-col .v4-profile-panel { left: 44px; bottom: 8px; }
.v4-profile-panel-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; border-bottom: 1px solid var(--v4-border);
}
.v4-profile-item {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px; width: 100%; border: none; background: none; cursor: pointer;
  color: var(--v4-text2); font-family: inherit; font-size: 13px; text-align: left;
  transition: background .1s; border-bottom: 1px solid var(--v4-border);
}
.v4-profile-item:last-child { border-bottom: none; }
.v4-profile-item:hover { background: var(--v4-bg); color: var(--v4-text); }
.v4-profile-item-danger { color: var(--v4-red); }
.v4-profile-item-danger:hover { background: var(--v4-red-bg); color: var(--v4-red); }
.v4-sidebar-col .v4-profile-btn { padding: 7px 0; justify-content: center; }
.v4-settings-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px 6px; font-size: 12.5px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--v4-text3);
  border-bottom: 1px solid var(--v4-border);
}
.v4-settings-item {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px; text-decoration: none; color: var(--v4-text2);
  transition: background .1s; border-bottom: 1px solid var(--v4-border);
  font-family: inherit;
}
.v4-settings-item:last-child { border-bottom: none; }
.v4-settings-item:hover { background: var(--v4-bg); color: var(--v4-text); }
.v4-settings-item-active { color: var(--v4-accent); background: var(--v4-accent-bg); }
.v4-settings-item-active:hover { background: var(--v4-accent-bg); }
.v4-sidebar-col .v4-settings-panel { left: 44px; bottom: 8px; width: 220px; }
.v4-sidebar-col .v4-group-label,
.v4-sidebar-col .v4-hist-section,
.v4-sidebar-col .v4-argus-signal-bar,
.v4-sidebar-col .v4-conn-label { display: none; }
.v4-sidebar-col .v4-sidebar-footer { padding: 8px 0; align-items: center; }
.v4-sidebar-col .v4-conn-row { padding: 4px 0; justify-content: center; }
.v4-sidebar-col .v4-settings-btn { padding: 7px 0; justify-content: center; }
@media (max-width: 767px) {
  .v4-sidebar { display: none; }
  .v4-mobile-topbar { display: flex; }
  .v4-bottom-nav { display: flex; }
  .v4-main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .v4-sidebar { width: 188px; }
  .v4-sidebar-col { width: 46px; }
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Design system partagé — cartes hero, avatars, badges de verdict ordinal.
   Utilisé par Décider, Architecturer et Copilote Décisionnel : un seul
   vocabulaire visuel, jamais une palette ou une typo réinventée par écran. */
.v4-hero-card {
  padding: 26px 30px; border-radius: 8px; color: #fff;
  background: linear-gradient(135deg, var(--v4-accent), color-mix(in oklab, var(--v4-accent) 65%, #4338CA));
  box-shadow: 0 16px 38px color-mix(in oklab, var(--v4-accent) 32%, transparent);
}
.v4-hero-eyebrow { font-size: 12.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; opacity: .85; margin-bottom: 8px; }
.v4-hero-title { font-family: var(--font-display, serif); font-size: 21px; font-weight: 600; line-height: 1.35; max-width: 760px; }
.v4-pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.v4-pill { font-size: 13px; font-weight: 700; padding: 6px 13px; border-radius: 999px; background: rgba(255,255,255,.16); }

.v4-avatar {
  width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800; color: #fff; flex-shrink: 0;
}
.v4-avatar-institution { border-radius: 8px; }

/* Verdict ordinal — ++ / + / 0 / − / −− : jamais un score numérique agrégé,
   le moteur Aura raisonne en ordinal qualitatif, pas en pourcentage. */
.v4-verdict {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  border-radius: 8px; padding: 14px 18px;
}
.v4-verdict b { font-family: var(--font-display, serif); font-size: 26px; line-height: 1; }
.v4-verdict span { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; text-align: center; }
.v4-verdict-pp { background: var(--v4-green-bg); color: var(--v4-green); }
.v4-verdict-p  { background: var(--v4-green-bg); color: var(--v4-green); }
.v4-verdict-0  { background: var(--v4-panel); color: var(--v4-text3); }
.v4-verdict-m  { background: var(--v4-amber-bg); color: var(--v4-amber); }
.v4-verdict-mm { background: var(--v4-red-bg); color: var(--v4-red); }
`;

// Filet de rattrapage propre à /cockpit/* : une erreur dans Décider ou
// Architecturer affiche ce message au lieu d'un écran blanc total — et
// reste locale à l'outil, pas besoin de faire remonter jusqu'à la racine.
function CockpitErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--v4-bg, #f6f5ff)", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--v4-text, #14121f)" }}>Cette page ne s'est pas chargée correctement</div>
        <p style={{ fontSize: 13.5, color: "var(--v4-text2, #57536b)", marginTop: 8, lineHeight: 1.6 }}>
          Une erreur est survenue. Vos données restent enregistrées — réessayez, ou revenez à l'accueil.
        </p>
        <pre style={{ marginTop: 12, textAlign: "left", fontSize: 12.5, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 140 }}>
          {error?.message}
        </pre>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6C5CE7", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Réessayer</button>
          <a href="/cockpit/home" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--v4-border, #e8e5f8)", color: "var(--v4-text2, #57536b)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>← Accueil</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/cockpit")({ component: CockpitShell, errorComponent: CockpitErrorComponent });