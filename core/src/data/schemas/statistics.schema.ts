import { z } from "zod";

export const progressionScopeSchema = z.union([
  z.literal("profile"),
  z.literal("character")
]);

export const statisticsAggregationKindSchema = z.union([
  z.literal("counter"),
  z.literal("max"),
  z.literal("flag")
]);

export const atomicGameplayFactSchema = z
  .object({
    factType: z.string().min(1),
    scope: progressionScopeSchema,
    scopeId: z.string().min(1),
    sourceActionId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    occurredAt: z.string().datetime(),
    value: z.number().finite().optional(),
    payload: z.record(z.unknown()).optional()
  })
  .strict();

export const statisticsDefinitionSchema = z
  .object({
    factType: z.string().min(1),
    scope: progressionScopeSchema,
    aggregation: statisticsAggregationKindSchema,
    initialValue: z.number().finite().optional(),
    maxValue: z.number().finite().optional()
  })
  .strict();

export const statisticsDefinitionCatalogSchema = z.array(statisticsDefinitionSchema);

export const achievementDefinitionSchema = z
  .object({
    achievementId: z.string().min(1),
    scope: progressionScopeSchema,
    statisticFactType: z.string().min(1),
    threshold: z.number().finite(),
    notificationEventType: z.string().min(1)
  })
  .strict();

export const achievementDefinitionCatalogSchema = z.array(achievementDefinitionSchema);

export type ProgressionScope = z.infer<typeof progressionScopeSchema>;
export type AtomicGameplayFact = z.infer<typeof atomicGameplayFactSchema>;
export type StatisticsDefinition = z.infer<typeof statisticsDefinitionSchema>;
export type AchievementDefinition = z.infer<typeof achievementDefinitionSchema>;
