// Graphes modifiables : positions mémorisées dans le modèle, versionnées,
// annulables et effacées par « Réorganiser ».
import { describe, expect, it } from "vitest";
import { blankVocab, withSupplyChainRulebook } from "../argus-vocab-store";
import { ontologyGraph } from "../supply-diagrams";
import { applyModelSnapshot, describeModelChange, modelSnapshot, ModelUndoStack } from "../supply-memory";
import { withSupplyChainModel } from "../supply-model";

const base = withSupplyChainModel(withSupplyChainRulebook(blankVocab()));

describe("positions des nœuds", () => {
  it("un objet déplacé garde sa position ; Réorganiser revient à la mise en page automatique", () => {
    const auto = ontologyGraph(base).nodes.find(n => n.id === "sc-site")!;
    const moved = { ...base, layout: { ontologie: { "sc-site": { x: 900, y: 200 } } } };
    const n = ontologyGraph(moved).nodes.find(x => x.id === "sc-site")!;
    expect(n.anchor).toEqual({ x: 900, y: 200 });
    expect(n.x).toBe(900);
    const { ontologie: _o, ...rest } = moved.layout;
    expect(ontologyGraph({ ...moved, layout: rest }).nodes.find(x => x.id === "sc-site")!.anchor).toEqual(auto.anchor);
  });

  it("la mise en page est versionnée et annulable avec le modèle", () => {
    const before = modelSnapshot(base);
    const after = modelSnapshot({ ...base, layout: { causal: { "r:S1": { x: 40, y: -12 } } } });
    expect(describeModelChange(before, after)).toBe("Mise en page modifiée");
    const stack = new ModelUndoStack(before);
    stack.push(after);
    expect(applyModelSnapshot(base, stack.undo()!).layout).toBeUndefined();
    expect(applyModelSnapshot(base, stack.redo()!).layout).toEqual({ causal: { "r:S1": { x: 40, y: -12 } } });
  });
});
