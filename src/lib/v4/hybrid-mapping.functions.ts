import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { llmChat } from "../llm.server";

const CandidateSchema = z.object({
  fieldId: z.string(),
  fieldName: z.string(),
  appLabel: z.string(),
  samples: z.array(z.string()).max(5),
  semanticScore: z.number().min(0).max(1),
  semanticRationale: z.string(),
  profile: z.string(),
  expected: z.string().nullable(),
});

const InputSchema = z.object({
  entity: z.object({ name: z.string(), description: z.string().optional() }),
  attribute: z.object({ name: z.string(), type: z.string() }),
  candidates: z.array(CandidateSchema).max(5),
});

export interface HybridMappingCandidate {
  fieldId: string;
  semanticScore: number;
  llmScore: number | null;
  hybridScore: number;
  llmRationale: string;
  rationale: string;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function combineHybridConfidence(semanticScore: number, llmScore: number | null, profileMismatch = false) {
  if (llmScore == null) return clamp(semanticScore);
  const semantic = clamp(semanticScore);
  const contextual = clamp(llmScore);
  let score = 0.65 * semantic + 0.35 * contextual;
  if (Math.abs(semantic - contextual) > 0.45) score *= 0.8;
  if (profileMismatch) score = Math.min(score, 0.55);
  return clamp(score);
}

export const refineMappingCandidates = createServerFn({ method: "POST" })
  .validator(InputSchema)
  .handler(async ({ data }): Promise<{ llmAvailable: boolean; candidates: HybridMappingCandidate[] }> => {
    if (data.candidates.length === 0) return { llmAvailable: false, candidates: [] };

    const result = await llmChat({
      temperature: 0,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Tu évalues des candidats de mapping de données. Utilise uniquement les métadonnées, scores et échantillons fournis. N'invente ni champ ni valeur. Un bon mapping doit respecter le sens métier et le type des valeurs. Réponds en JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Évaluer chaque candidat pour relier un attribut d'ontologie à un champ source.",
            target: { entity: data.entity, attribute: data.attribute },
            candidates: data.candidates,
            expectedResponse: {
              assessments: [{ fieldId: "id exact", confidence: "nombre 0..100", rationale: "justification courte fondée sur les éléments fournis" }],
            },
          }),
        },
      ],
    });

    let assessments = new Map<string, { confidence: number; rationale: string }>();
    if (result.ok) {
      try {
        const parsed = JSON.parse(result.content) as { assessments?: Array<{ fieldId?: string; confidence?: number; rationale?: string }> };
        assessments = new Map((parsed.assessments ?? []).map(item => [
          String(item.fieldId ?? ""),
          { confidence: clamp(Number(item.confidence ?? 0) / 100), rationale: String(item.rationale ?? "Analyse contextuelle sans justification.") },
        ]));
      } catch {
        assessments = new Map();
      }
    }

    const llmAvailable = result.ok && assessments.size > 0;
    const candidates = data.candidates.map(candidate => {
      const assessment = assessments.get(candidate.fieldId);
      const llmScore = assessment?.confidence ?? null;
      const profileMismatch = Boolean(candidate.expected && candidate.profile !== "empty" && candidate.profile !== "text" && candidate.profile !== candidate.expected);
      const hybridScore = combineHybridConfidence(candidate.semanticScore, llmScore, profileMismatch);
      const llmRationale = assessment?.rationale ?? "LLM indisponible : score sémantique conservé.";
      return {
        fieldId: candidate.fieldId,
        semanticScore: candidate.semanticScore,
        llmScore,
        hybridScore,
        llmRationale,
        rationale: `${candidate.semanticRationale} · ${llmRationale}`,
      };
    }).sort((a, b) => b.hybridScore - a.hybridScore);

    return { llmAvailable, candidates };
  });
