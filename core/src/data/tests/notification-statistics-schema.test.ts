import {
  achievementDefinitionCatalogSchema,
  atomicGameplayFactSchema,
  notificationPolicyCatalogSchema,
  statisticsDefinitionCatalogSchema
} from "../schemas";

describe("notification/statistics schemas", () => {
  it("parses a valid notification policy catalog", () => {
    const parsed = notificationPolicyCatalogSchema.parse([
      {
        eventType: "achievement.earned",
        deliveryPolicy: "client-and-server",
        channels: ["toast", "system-chat"],
        audience: "global",
        toastVariant: "achievement-earned",
        chatTemplate: "{player} earned {achievement}",
        serverFanout: true
      }
    ]);

    expect(parsed).toHaveLength(1);
  });

  it("parses an atomic gameplay fact", () => {
    const parsed = atomicGameplayFactSchema.parse({
      factType: "dungeon.cleared",
      scope: "character",
      scopeId: "char-1",
      sourceActionId: "run-123",
      sequence: 0,
      occurredAt: new Date().toISOString(),
      value: 1
    });

    expect(parsed.factType).toBe("dungeon.cleared");
  });

  it("parses statistics and achievement catalogs", () => {
    const stats = statisticsDefinitionCatalogSchema.parse([
      {
        factType: "dungeon.cleared",
        scope: "character",
        aggregation: "counter",
        initialValue: 0
      }
    ]);

    const achievements = achievementDefinitionCatalogSchema.parse([
      {
        achievementId: "dungeon-100-character",
        scope: "character",
        statisticFactType: "dungeon.cleared",
        threshold: 100,
        notificationEventType: "achievement.earned"
      }
    ]);

    expect(stats).toHaveLength(1);
    expect(achievements).toHaveLength(1);
  });
});
