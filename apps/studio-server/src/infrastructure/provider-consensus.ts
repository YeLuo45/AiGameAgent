// V21 ProviderConsensus (Direction E 21/30, chatdev)
// When multiple adapters return, decide the consensus answer

export interface ProviderAnswer {
  providerId: string;
  text: string;
  confidence: number; // 0-1
  latencyMs: number;
}

export type ConsensusStrategy = "majority-vote" | "highest-confidence" | "longest" | "weighted";

export interface ConsensusConfig {
  strategy: ConsensusStrategy;
  /** Min agreement ratio for majority-vote (0-1). */
  minAgreement: number;
}

export interface ConsensusResult {
  text: string;
  agreement: number; // 0-1
  confidence: number; // 0-1
  totalProviders: number;
  agreedProviders: string[];
  strategy: ConsensusStrategy;
  /** Whether the consensus is strong enough to use. */
  accepted: boolean;
}

export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = { strategy: "weighted", minAgreement: 0.6 };

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function jaccard(a: string, b: string): number {
  const setA = new Set(normalize(a).split(" "));
  const setB = new Set(normalize(b).split(" "));
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export function findConsensus(answers: ProviderAnswer[], config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG): ConsensusResult {
  if (answers.length === 0) return { text: "", agreement: 0, confidence: 0, totalProviders: 0, agreedProviders: [], strategy: config.strategy, accepted: false };
  if (answers.length === 1) return { text: answers[0].text, agreement: 1, confidence: answers[0].confidence, totalProviders: 1, agreedProviders: [answers[0].providerId], strategy: config.strategy, accepted: true };
  if (config.strategy === "highest-confidence") {
    const best = answers.reduce((a, b) => a.confidence >= b.confidence ? a : b);
    return { text: best.text, agreement: 1, confidence: best.confidence, totalProviders: answers.length, agreedProviders: [best.providerId], strategy: config.strategy, accepted: true };
  }
  if (config.strategy === "longest") {
    const best = answers.reduce((a, b) => a.text.length >= b.text.length ? a : b);
    return { text: best.text, agreement: 1, confidence: best.confidence, totalProviders: answers.length, agreedProviders: [best.providerId], strategy: config.strategy, accepted: true };
  }
  if (config.strategy === "weighted") {
    // Weight by confidence
    const best = answers.reduce((a, b) => a.confidence >= b.confidence ? a : b);
    const agreement = answers.filter((a) => jaccard(a.text, best.text) > 0.7).length / answers.length;
    return { text: best.text, agreement, confidence: best.confidence, totalProviders: answers.length, agreedProviders: answers.filter((a) => jaccard(a.text, best.text) > 0.7).map((a) => a.providerId), strategy: config.strategy, accepted: agreement >= config.minAgreement };
  }
  // majority-vote: find largest cluster with jaccard > 0.7
  let bestCluster: string[] = [];
  for (const a of answers) {
    const cluster = answers.filter((b) => jaccard(a.text, b.text) > 0.7).map((b) => b.providerId);
    if (cluster.length > bestCluster.length) bestCluster = cluster;
  }
  const agreement = bestCluster.length / answers.length;
  const rep = answers.find((a) => bestCluster.includes(a.providerId))!;
  return { text: rep.text, agreement, confidence: rep.confidence, totalProviders: answers.length, agreedProviders: bestCluster, strategy: config.strategy, accepted: agreement >= config.minAgreement };
}

export { jaccard, normalize };

/** Master metric: consensus quality 0-1. */
export function consensusQuality(result: ConsensusResult): number {
  if (result.totalProviders === 0) return 0;
  return result.agreement * result.confidence;
}
