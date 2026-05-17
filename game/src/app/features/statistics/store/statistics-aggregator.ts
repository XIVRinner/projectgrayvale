import { type AtomicGameplayFact } from "@rinner/grayvale-core";

export interface StatisticEntry {
  readonly value: number;
  readonly updatedAt: string;
}

export type StatisticStore = Record<string, StatisticEntry>;

export function createFactIdentityKey(fact: AtomicGameplayFact): string {
  return `${fact.factType}::${fact.scope}::${fact.scopeId}::${fact.sourceActionId}::${fact.sequence}`;
}

export function applyCounter(current: number, delta: number): number {
  return current + delta;
}

export function applyMax(current: number, candidate: number): number {
  return Math.max(current, candidate);
}

export function applyFlag(current: number, nextValue: number): number {
  return current > 0 || nextValue > 0 ? 1 : 0;
}

export function createStatisticKey(factType: string, scope: string, scopeId: string): string {
  return `${factType}::${scope}::${scopeId}`;
}
