// Proposition du modèle de décision par le LLM (options, critères, niveaux
// d'impact) ; repli sur le générateur sans clé si le modèle est indisponible.
import { docsContext, sanitizeCitations, type DialogueDoc } from "./doc-citations";
import { createServerFn } from "@tanstack/react-start";
import { heuristicProposal, sanitizeProposal, type Proposal } from "./decision-dialogue";

// Prompt dédié : réponse riche mais structurée, validée par sanitizeProposal
// (aucun chiffre absent de la question, aucun gagnant ni classement).
export const DECISION_PROMPT = `Tu prépares un modèle de décision qualitatif, sans jamais le calculer. Réponds en JSON strict :
{"enjeu": "reformulation claire de l'enjeu en une phrase",
 "options": string[2..4],
 "criteria": [{"label": string, "importance": "Essentiel"|"Important"|"Secondaire"|"Faible"}] (3 à 5),
 "impacts": {"<option>": {"<critère>": "++"|"+"|"+L"|"0"|"-L"|"-"|"--"}},
 "optionWhy": {"<option>": "ce que fait l'option, une phrase"},
 "impactWhy": {"<option>": {"<critère>": "pourquoi cet effet, une phrase"}},
 "risques": string[2..5],
 "modele": {"objectifs": [{"label": string, "criteres": [{"label": string, "indicateurs": [{"label": "paramètre précis du domaine, avec son unité si utile", "why": "pourquoi il compte, une phrase"}]}]}] (1 ou 2 objectifs, 2 ou 3 critères au total, 5 à 8 indicateurs au total),
            "leviers": [{"label": "variable que le décideur contrôle", "options": [{"label": "option concrète et nommée du domaine", "why": "ce qu'elle fait, une phrase"}] (2 à 4)}] (2 à 4 leviers en plus des options de la question, dont une option latérale crédible)},
 "pestel": {"P"|"E"|"S"|"T"|"En"|"L": "facteur externe qui pèse sur cette décision, une phrase"} (3 à 6 dimensions pertinentes),
 "questions": string[0..3] (questions de cadrage vraiment utiles, jamais génériques)}
Minimums exigés, sinon ta réponse est écartée et remplacée par le modèle déterministe d'Aura : plusieurs options (2 à 4) pour que plusieurs scénarios soient comparables, 2 à 4 leviers en plus de celui de la question (donc 3 à 5 leviers au total) avec 2 à 4 options chacun, 5 à 8 indicateurs répartis sous 2 ou 3 critères et 1 ou 2 objectifs.
Niveaux ordinaux seulement (NUL, L, M, H avec un sens) : aucun chiffre, aucun montant, aucun pourcentage qui ne figure pas dans la question.
Ne désigne jamais de gagnant, de classement ni de score : le moteur de décision s'en charge.
Reprends exactement les options de la question si elles y sont.
Supply Chain : l'ontologie d'Aura comporte fournisseur, article, site, stock, commande d'achat, expédition, commande client, vente, prévision de demande et perturbation. Les alertes possibles : capacité ou risque fournisseur, couverture de stock et rupture, retard transport ou retards fournisseur, écart de prévision, risque géopolitique, capacité insuffisante, marge menacée, changement de nomenclature, réseau logistique, écarts entre sources de données (valeur différente de l'application maître). Choisis des critères mesurables de cette chaîne (probabilité de rupture, taux de service, OTIF fournisseur, couverture en jours, délai de mise en œuvre, coût d'achat, coût de possession, coût et émissions du transport, biais de prévision, cohérence des données) ; Aura les organise en 5 à 8 indicateurs, sous 2 ou 3 critères et 1 ou 2 objectifs, et complète 3 à 5 leviers.`;

// Documents joints : le modèle cite des extraits littéraux ; toute citation absente du document est écartée.
export const DOCS_PROMPT = `Des documents sont joints. Sers-t'en pour préciser leviers et options (modele.leviers), critères, risques et PESTEL, uniquement avec ce qu'ils disent. Ajoute "contraintes": string[] (0 à 4, seulement celles écrites dans les documents). Ajoute au JSON la clé "citations": [{"extrait": "copie exacte, mot pour mot, d'une phrase des documents", "fichier": "nom du fichier", "usage": "ce que l'extrait change dans le modèle, une phrase"}] (1 à 5). N'invente aucun chiffre ni fait absent des documents ou de la question.`;

export const proposeDecisionModel = createServerFn({ method: "POST" })
  .validator((d: { question: string; context?: string; alertKpi?: string; knownOptions?: string[]; lang?: "fr" | "en"; documents?: DialogueDoc[] }) => ({ ...d, documents: (d.documents ?? []).slice(0, 5).map(x => ({ name: String(x.name).slice(0, 200), text: String(x.text).slice(0, 200_000) })) }))
  .handler(async ({ data }): Promise<Proposal> => {
    const fallback = heuristicProposal(data.question, data.alertKpi, data.knownOptions);
    try {
      const { mistralChat } = await import("../mistral.server");
      const r = await mistralChat({
        jsonMode: true, temperature: 0.2, maxTokens: 3200,
        messages: [
          { role: "system", content: DECISION_PROMPT + (data.knownOptions?.length ? ` Options imposées : ${data.knownOptions.join(" | ")}.` : "") + (data.lang === "en" ? " Write every text field (enjeu, labels, optionWhy, impactWhy, risques) in English; keep the JSON keys and the option names given by the user unchanged." : "") },
          ...(data.documents.length ? [{ role: "system" as const, content: DOCS_PROMPT }] : []),
          { role: "user", content: `Question : ${data.question}\n${data.context ? `Contexte : ${data.context.slice(0, 1500)}` : ""}${data.documents.length ? `\nDocuments joints :\n${docsContext(data.documents)}` : ""}` },
        ],
      });
      if (!r.ok) return fallback;
      const raw = JSON.parse(r.content) as Partial<Proposal>;
      const parsed = sanitizeProposal(raw, `${data.question} ${data.context ?? ""}`);
      if (parsed && data.documents.length) {
        parsed.citations = sanitizeCitations(raw.citations, data.documents);
        // Une contrainte n'est gardée que si au moins une citation l'appuie (rien d'inventé).
        parsed.contraintes = parsed.citations.length ? (Array.isArray(raw.contraintes) ? raw.contraintes : []).filter((c): c is string => typeof c === "string" && c.trim().length > 3).slice(0, 4).map(c => c.trim().slice(0, 200)) : [];
      }
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  });
