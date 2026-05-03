import {
  assertValidQuest,
  assertValidQuestObjective,
  parseQuest,
  type CompositeObjective,
  type Quest
} from "./index";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const loadFixture = (fileName: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, fileName), "utf8")) as unknown;

describe("quest objective validation", () => {
  it("validates each supported objective type", () => {
    expect(() =>
      assertValidQuestObjective({
        type: "attribute_reached",
        attribute: "vitality",
        target: 10
      })
    ).not.toThrow();

    expect(() =>
      assertValidQuestObjective({
        type: "item_collected",
        itemId: "monster_hide",
        quantity: 10
      })
    ).not.toThrow();

    expect(() =>
      assertValidQuestObjective({
        type: "activity_duration",
        activityId: "woodcutting",
        duration: 120
      })
    ).not.toThrow();

    expect(() =>
      assertValidQuestObjective({
        type: "kill",
        target: "monster",
        count: 10
      })
    ).not.toThrow();
  });

  it("loads the attribute quest fixture", () => {
    const quest = loadFixture("quest.fixture.attribute.json");

    expect(() => assertValidQuest(quest)).not.toThrow();
    expect(parseQuest(quest)).toEqual({
      id: "quest_vitality",
      objectives: [
        {
          type: "attribute_reached",
          attribute: "vitality",
          target: 10
        }
      ]
    });
  });

  it("supports nested composite objectives", () => {
    const quest = parseQuest(loadFixture("quest.fixture.compound.json"));
    const composite = quest.objectives[0] as CompositeObjective;

    expect(() => assertValidQuest(quest)).not.toThrow();
    expect(composite.type).toBe("composite");
    expect(composite.operator).toBe("AND");
    expect(composite.objectives).toEqual([
      {
        type: "kill",
        target: "monster",
        count: 10
      },
      {
        type: "item_collected",
        itemId: "monster_hide",
        quantity: 10
      }
    ]);
  });

  it("rejects invalid quest structures", () => {
    const missingAttribute = {
      id: "quest_invalid_attribute",
      objectives: [
        {
          type: "attribute_reached",
          target: 10
        }
      ]
    };

    const invalidOperator = {
      id: "quest_invalid_operator",
      objectives: [
        {
          type: "composite",
          operator: "XOR",
          objectives: []
        }
      ]
    };

    const invalidKillCount = {
      id: "quest_invalid_kill_count",
      objectives: [
        {
          type: "kill",
          target: "monster",
          count: 0
        }
      ]
    };

    expect(() => assertValidQuest(missingAttribute)).toThrow(
      "quest.objectives[0].attribute must be a non-empty string."
    );
    expect(() => assertValidQuest(invalidOperator)).toThrow(
      'quest.objectives[0].operator must be "AND" or "OR".'
    );
    expect(() => assertValidQuest(invalidKillCount)).toThrow(
      "quest.objectives[0].count must be a positive finite number."
    );
  });

  it("accepts rewards when they are represented as an array payload", () => {
    const quest: Quest = {
      id: "quest_rewarded",
      objectives: [
        {
          type: "item_collected",
          itemId: "ore_chunk",
          quantity: 3
        }
      ],
      rewards: [{ type: "currency", amount: 50 }]
    };

    expect(() => assertValidQuest(quest)).not.toThrow();
  });
});
