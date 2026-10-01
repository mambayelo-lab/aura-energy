// Configuration de build Lovable (TanStack Start).
// Le wrapper @lovable.dev/vite-tanstack-config fournit déjà : tanstackStart,
// viteReact, tailwindcss, tsConfigPaths, nitro, injection VITE_*, alias @,
// dédoublonnage React/TanStack et détection sandbox — ne pas les rajouter à la
// main (plugins dupliqués = app cassée). La sortie de publication attendue est
// `dist/`, ce que le wrapper garantit.
//
// `nitro.preset: "vercel"` ne s'applique QUE hors build Lovable (CI Vercel du
// projet) : dans un build Lovable, la cible et la disposition de sortie sont
// imposées par la plateforme.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Filet de sécurité de publication : si la plateforme n'injecte pas les
// variables VITE_SUPABASE_* dans le build, le client Supabase lève
// « Missing Supabase environment variable(s) » et toute la page tombe.
// On fige alors les valeurs publiques (URL + clé publishable, non secrètes)
// à la compilation. Aucun effet quand les variables sont bien injectées.
const SB_URL = "https://gxqneyjkdxwbssxcdgok.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cW5leWprZHh3YnNzeGNkZ29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTEwNDAsImV4cCI6MjA5Njc2NzA0MH0.INGcgLves8GCJCT3IH_s5ioqVgJBWzAfv_kNIFtK1pw";
const fallbackDefine: Record<string, string> = {};
if (!process.env.VITE_SUPABASE_URL) {
  fallbackDefine["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(SB_URL);
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  fallbackDefine["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(SB_KEY);
}

export default defineConfig({
  tanstackStart: {
    // Redirige l'entrée serveur de TanStack Start vers src/server.ts
    // (notre enveloppe de capture d'erreurs SSR).
    server: { entry: "server" },
  },
  nitro: { preset: "vercel" },
  vite: {
    define: fallbackDefine,
    resolve: {
      // Le SDK Stripe fait un require("https") CJS "nu" (sans préfixe
      // node:) ; l'étape de build Nitro (preset vercel) échoue à le
      // reconnaître comme module natif Node et tente de le résoudre comme
      // un paquet npm, ce qui casse le build (« Failed to resolve entry
      // for package "https" »). On redirige ces spécificateurs nus vers
      // leur équivalent préfixé "node:", que Nitro externalise déjà
      // correctement — comportement runtime strictement identique.
      alias: {
        https: "node:https",
        http: "node:http",
        net: "node:net",
        tls: "node:tls",
        crypto: "node:crypto",
        stream: "node:stream",
        zlib: "node:zlib",
        dns: "node:dns",
      },
    },
    ssr: {
      noExternal: ["@dagrejs/dagre"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Chemins exacts pour ne pas attraper react-smooth / react-is
            // (dépendances de recharts), qui créaient une dépendance
            // circulaire entre react-vendor et charts-vendor.
            if (/node_modules\/(react|react-dom)\//.test(id)) return "react-vendor";
            if (id.includes("node_modules/@tanstack")) return "tanstack-vendor";
            if (id.includes("node_modules/@dagrejs")) return "dagre-vendor";
            // Données statiques volumineuses
            if (id.includes("playbook-analysis-patterns")) return "playbooks-data";
            if (id.includes("pb-assets") || id.includes("pb-vehicles") || id.includes("pb-industry")) return "playbooks-data";
            if (id.includes("reference-blueprints") || id.includes("decideur-data")) return "decision-data";
            if (id.includes("sector-presets") || id.includes("playbooks-energy") || id.includes("playbooks-strategy")) return "sector-data";
            // Catalogue EA isolé (volumineux)
            if (id.includes("ea-catalog")) return "ea-catalog";
            return undefined;
          },
        },
      },
    },
  },
});
