// StudioGuide.tsx — le parcours guidé du Studio (Copilote Décideur) : la même
// boucle qu'ailleurs dans Aura (Aura pose la question → vous répondez à la voix
// → Aura reformule → vous validez → la réponse s'inscrit), appliquée aux étapes
// de paramétrage du Studio : vocabulaire métier, applications sources et leurs
// accès (API, OAuth 2.0, MCP), objets métier, puis mappings.
//
// Rien n'est deviné : chaque réponse validée écrit dans le vocabulaire réel du
// Studio (ArgusVocab), aux mêmes endroits que la saisie manuelle.

import React, { useMemo, useState } from "react";
import { CompagnonAura, CompagnonLauncher, type CompanionStep } from "./CompagnonAura";
import type {
  ArgusVocab, KpiDef, AppCredential, AppField, BusinessEntity,
} from "../../lib/v4/argus-vocab-store";

/** Découpe une réponse dictée en éléments : « marge brute, taux de service ». */
function splitItems(text: string): string[] {
  return text
    .split(/[,;\n•]| et | puis /i)
    .map(s => s.replace(/^[-–\s]+/, "").trim())
    .filter(s => s.length > 1)
    .slice(0, 12);
}

/** Premiers nombres cités, dans l'ordre — pour les seuils dictés. */
function numbersIn(text: string): number[] {
  return (text.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map(n => Number(n.replace(",", ".")));
}

function slug(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
}

/** Rapprochement lexical simple entre un libellé dicté et une liste. */
function bestMatch<T>(text: string, items: T[], label: (t: T) => string): T | null {
  const wanted = slug(text);
  if (!wanted) return null;
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const cand = slug(label(item));
    const score = cand === wanted ? 100
      : cand.includes(wanted) || wanted.includes(cand) ? 60
        : cand.split("_").filter(w => w.length > 3 && wanted.includes(w)).length * 20;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best ? best.item : null;
}

const PROTOCOLS: { key: string; match: RegExp; hint: string }[] = [
  { key: "MCP", match: /mcp|model context|protocole de contexte/i, hint: "Serveur MCP — outils exposés par le SI" },
  { key: "OAuth 2.0", match: /oauth|client credential|jeton|token/i, hint: "OAuth 2.0 Client Credentials" },
  { key: "API REST", match: /api|rest|http/i, hint: "API REST — login applicatif" },
  { key: "Fichier", match: /fichier|export|csv|excel/i, hint: "Export de fichier périodique" },
];

export function StudioGuide({ vocab, onUpdate, onSection }: {
  vocab: ArgusVocab;
  onUpdate: (v: ArgusVocab) => void;
  /** Le Studio suit le fil : il affiche la section concernée par la question. */
  onSection?: (section: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startAt, setStartAt] = useState(0);

  // Le vocabulaire évolue au fil des réponses : on lit toujours l'état courant
  // via une référence mutable locale, pour ne pas écraser le pas précédent.
  const draft = useMemo(() => ({ current: vocab }), [vocab]);
  const patch = (v: ArgusVocab) => { draft.current = v; onUpdate(v); };

  const steps: CompanionStep[] = [
    {
      id: "domaine", group: "Vocabulaire métier",
      question: "Sur quel domaine métier travaillons-nous ?",
      hint: "Retail, énergie, industrie, banque, santé…",
      current: vocab.domaine,
      apply: t => patch({ ...draft.current, domaine: t.trim() }),
    },
    {
      id: "kpis", group: "Vocabulaire métier",
      question: "Quels indicateurs pilotez-vous vraiment ?",
      hint: "Citez-les d'affilée : marge brute, taux de service, rotation des stocks.",
      current: vocab.kpis.map(k => k.label).join(", "),
      apply: t => {
        const existing = new Set(draft.current.kpis.map(k => k.label.toLowerCase()));
        const created: KpiDef[] = splitItems(t)
          .filter(label => !existing.has(label.toLowerCase()))
          .map(label => ({
            id: crypto.randomUUID(), label,
            unit: "—", direction: "en_dessous_alerte" as const,
            seuilAlerte: 0, seuilCritique: 0,
          }));
        if (created.length) patch({ ...draft.current, kpis: [...draft.current.kpis, ...created] });
      },
    },
    {
      id: "seuils", group: "Vocabulaire métier", optional: true,
      question: "Sur le premier indicateur, à partir de quelle valeur alertez-vous, et à partir de quelle valeur est-ce critique ?",
      hint: "Deux nombres suffisent : le seuil d'alerte puis le seuil critique.",
      apply: t => {
        const [alerte, critique] = numbersIn(t);
        const first = draft.current.kpis[0];
        if (!first || alerte === undefined) return;
        patch({
          ...draft.current,
          kpis: draft.current.kpis.map(k => k.id === first.id
            ? { ...k, seuilAlerte: alerte, seuilCritique: critique ?? alerte }
            : k),
        });
      },
    },
    {
      id: "apps", group: "Applications sources",
      question: "Quelles applications détiennent ces données ?",
      hint: "Nommez-les : SAP, Salesforce, l'entrepôt de données…",
      current: vocab.apps.map(a => a.label).join(", "),
      apply: t => {
        const existing = new Set(draft.current.apps.map(a => a.label.toLowerCase()));
        const created: AppCredential[] = splitItems(t)
          .filter(label => !existing.has(label.toLowerCase()))
          .map(label => ({
            id: crypto.randomUUID(), label, type: "À qualifier",
            connectionHint: "À qualifier", secretConfigured: false,
          }));
        if (created.length) patch({ ...draft.current, apps: [...draft.current.apps, ...created] });
      },
    },
    {
      id: "protocole", group: "Applications sources",
      question: "Comment accède-t-on à la première de ces applications ?",
      hint: "API REST, OAuth 2.0, serveur MCP, ou export de fichier.",
      apply: t => {
        const proto = PROTOCOLS.find(p => p.match.test(t));
        const first = draft.current.apps[0];
        if (!first) return;
        patch({
          ...draft.current,
          apps: draft.current.apps.map(a => a.id === first.id
            ? { ...a, connectionHint: proto?.hint ?? t.trim() }
            : a),
        });
      },
    },
    {
      id: "champs", group: "Applications sources", optional: true,
      question: "Quels champs de cette application portent vos indicateurs ?",
      hint: "Les noms techniques suffisent : CO-PA.marge_brute_pct, ZSD.taux_service.",
      apply: t => {
        const first = draft.current.apps[0];
        if (!first) return;
        const existing = new Set(draft.current.fields.map(f => f.name.toLowerCase()));
        const created: AppField[] = splitItems(t)
          .filter(name => !existing.has(name.toLowerCase()))
          .map(name => ({ id: crypto.randomUUID(), appId: first.id, name, sampleValues: [] }));
        if (created.length) patch({ ...draft.current, fields: [...draft.current.fields, ...created] });
      },
    },
    {
      id: "entites", group: "Objets métier",
      question: "Quels objets métier structurent votre activité ?",
      hint: "Client, commande, magasin, fournisseur, contrat…",
      current: (vocab.entities ?? []).map(e => e.name).join(", "),
      apply: t => {
        const existing = new Set((draft.current.entities ?? []).map(e => e.name.toLowerCase()));
        const created: BusinessEntity[] = splitItems(t)
          .filter(name => !existing.has(name.toLowerCase()))
          .map(name => ({ id: crypto.randomUUID(), name, attributes: [] }));
        if (created.length) patch({ ...draft.current, entities: [...(draft.current.entities ?? []), ...created] });
      },
    },
    {
      id: "mapping", group: "Mappings", optional: true,
      question: "Quel champ alimente votre premier indicateur ?",
      hint: "Nommez le champ : Aura le rapproche de l'indicateur et pose le mapping.",
      apply: t => {
        const kpi = draft.current.kpis[0];
        const field = bestMatch(t, draft.current.fields, f => f.name);
        if (!kpi || !field) return;
        if (draft.current.mappings.some(m => m.kpiId === kpi.id && m.fieldId === field.id)) return;
        patch({
          ...draft.current,
          mappings: [...draft.current.mappings, {
            id: crypto.randomUUID(), kpiId: kpi.id, appId: field.appId,
            fieldId: field.id, method: "manuel" as const,
          }],
        });
      },
    },
  ];

  const sectionOf: Record<string, string> = {
    domaine: "vocab", kpis: "vocab", seuils: "vocab",
    apps: "apps", protocole: "apps", champs: "data",
    entites: "entities", mapping: "mappings",
  };

  return (
    <>
      <CompagnonLauncher onClick={() => { setStartAt(0); setOpen(true); }} label="Paramétrer avec Aura" />
      <CompagnonAura
        open={open}
        onClose={() => setOpen(false)}
        steps={steps}
        startAt={startAt}
        title="Paramétrer le Studio"
        contextPrompt={[vocab.domaine, ...vocab.kpis.map(k => k.label), ...vocab.apps.map(a => a.label)].filter(Boolean).join(", ")}
        onStepChange={(_, step) => { const s = sectionOf[step.id]; if (s) onSection?.(s); }}
      />
    </>
  );
}
