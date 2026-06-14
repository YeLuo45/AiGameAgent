// V7 MemoryInjector (Direction A 7/30, nanobot)
// Inject memory context into LLM prompts (within budget)

export interface PromptSection {
  role: "system" | "user";
  content: string;
  /** Token estimate. */
  tokens: number;
  /** Priority for inclusion (lower = higher priority). */
  priority: number;
  /** Source layer. */
  layer: "L0" | "L1" | "L2" | "L3" | "L4";
}

export interface InjectionPlan {
  sections: PromptSection[];
  totalTokens: number;
  budgetUsed: number;
  budget: number;
  omitted: number;
}

export function buildPromptSections(opts: {
  l0Recent?: Array<{ agentId: string; text: string }>;
  l1Charter?: { goal: string; milestones: string[]; nodes: string[] };
  l2Recent?: string;
  l3Notes?: Array<{ agentId: string; category: string; content: string }>;
  l4Patterns?: Array<{ key: string; value: string; confidence: number }>;
}): PromptSection[] {
  const out: PromptSection[] = [];
  if (opts.l1Charter) {
    out.push({
      role: "system",
      content: `[L1 Charter]\nGoal: ${opts.l1Charter.goal}\nMilestones: ${opts.l1Charter.milestones.join(", ")}\nNodes: ${opts.l1Charter.nodes.join(", ")}`,
      tokens: Math.floor((opts.l1Charter.goal.length + opts.l1Charter.milestones.join("").length + opts.l1Charter.nodes.join("").length) / 4) + 10,
      priority: 1,
      layer: "L1",
    });
  }
  if (opts.l4Patterns) {
    const lines = opts.l4Patterns.map((p) => `- ${p.key}: ${p.value} (confidence ${(p.confidence * 100).toFixed(0)}%)`).join("\n");
    out.push({ role: "system", content: `[L4 Patterns]\n${lines}`, tokens: Math.floor(lines.length / 4) + 5, priority: 2, layer: "L4" });
  }
  if (opts.l2Recent) {
    out.push({ role: "system", content: `[L2 Recent Changes]\n${opts.l2Recent}`, tokens: Math.floor(opts.l2Recent.length / 4) + 5, priority: 3, layer: "L2" });
  }
  if (opts.l3Notes) {
    const lines = opts.l3Notes.map((n) => `- [${n.category}] ${n.content}`).join("\n");
    out.push({ role: "system", content: `[L3 Notes]\n${lines}`, tokens: Math.floor(lines.length / 4) + 5, priority: 4, layer: "L3" });
  }
  if (opts.l0Recent) {
    const lines = opts.l0Recent.map((e) => `${e.agentId}: ${e.text}`).join("\n");
    out.push({ role: "user", content: `[L0 Recent]\n${lines}`, tokens: Math.floor(lines.length / 4) + 5, priority: 5, layer: "L0" });
  }
  return out;
}

/** Plan injection within a token budget (prioritizes L1 > L4 > L2 > L3 > L0). */
export function planInjection(sections: PromptSection[], budget: number): InjectionPlan {
  const sorted = [...sections].sort((a, b) => a.priority - b.priority);
  const included: PromptSection[] = [];
  let used = 0;
  let omitted = 0;
  for (const s of sorted) {
    if (used + s.tokens <= budget) {
      included.push(s);
      used += s.tokens;
    } else {
      omitted++;
    }
  }
  const totalTokens = included.reduce((acc, s) => acc + s.tokens, 0);
  return { sections: included, totalTokens, budgetUsed: used, budget, omitted };
}

export function formatAsSystemPrompt(plan: InjectionPlan, separator: string = "\n\n"): string {
  return plan.sections.map((s) => s.content).join(separator);
}

/** Master metric: injection efficiency 0-1 (used/budget). */
export function injectionEfficiency(plan: InjectionPlan): number {
  if (plan.budget === 0) return 0;
  return Math.min(1, plan.budgetUsed / plan.budget);
}
