export function impactLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 75) return "Impact élevé";
  if (score >= 40) return "Impact modéré";
  return "Impact faible";
}

export function feasibilityLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 75) return "Faisabilité forte";
  if (score >= 40) return "Faisabilité moyenne";
  return "Faisabilité faible";
}

export function priorityLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 75) return "Priorité élevée";
  if (score >= 40) return "Priorité moyenne";
  return "Priorité faible";
}

export function confidenceLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 75) return "Confiance forte";
  if (score >= 40) return "Confiance moyenne";
  return "Confiance faible";
}

export function priorityColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-blue-600";
}

export function confidenceColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-muted-foreground";
}
