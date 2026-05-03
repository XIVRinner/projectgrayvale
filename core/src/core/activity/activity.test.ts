import {
  createActivity,
  type Activity,
  type ActivityDefinition,
  type ActivityReward,
  type ActivityTickDelta
} from "./index";

describe("activity", () => {
  it("creates an activity with only a type", () => {
    expect(createActivity("activity_tick")).toEqual({ type: "activity_tick" });
  });

  it("preserves payload values", () => {
    const activity = createActivity("gather", {
      resource: "iron_ore",
      amount: 2
    });

    expect(activity).toEqual({
      type: "gather",
      payload: {
        resource: "iron_ore",
        amount: 2
      }
    });
  });

  it("copies and freezes the top-level activity payload", () => {
    const payload = {
      weaponId: "iron_dagger"
    };

    const activity = createActivity("attack", payload);

    expect(activity.payload).toEqual(payload);
    expect(activity.payload).not.toBe(payload);
    expect(Object.isFrozen(activity)).toBe(true);
    expect(Object.isFrozen(activity.payload)).toBe(true);
  });

  it("does not mutate the caller payload when the activity is changed", () => {
    const payload = {
      amount: 10
    };

    const activity = createActivity("damage_taken", payload) as Activity & {
      payload: Record<string, unknown>;
    };

    expect(() => {
      activity.payload.amount = 20;
    }).toThrow(TypeError);
    expect(payload).toEqual({ amount: 10 });
  });

  it("supports optional typed helpers without constraining the base type", () => {
    const activity: ActivityTickDelta = {
      type: "activity_tick",
      payload: {
        activityId: "mining",
        difficulty: 20,
        governingAttributes: ["mining"],
        tags: ["gathering", "ore"],
        tickDelta: 1,
        itemId: "copper_ore"
      }
    };

    const genericActivity: Activity = activity;

    expect(genericActivity).toEqual(activity);
  });

  it("supports authored activity definitions alongside bus events", () => {
    const rewards: ActivityReward[] = [
      {
        type: "currency",
        value: {
          type: "range",
          min: 3,
          max: 10
        },
        distribution: {
          type: "random"
        }
      }
    ];

    const activity: ActivityDefinition = {
      id: "mining",
      name: "Mining",
      description: "Extract ore from resource nodes over time.",
      tags: ["gathering", "resource"],
      governingAttributes: ["mining"],
      difficulty: 20,
      itemId: "copper_ore",
      rewards
    };

    expect(activity).toEqual({
      id: "mining",
      name: "Mining",
      description: "Extract ore from resource nodes over time.",
      tags: ["gathering", "resource"],
      governingAttributes: ["mining"],
      difficulty: 20,
      itemId: "copper_ore",
      rewards
    });
  });
});
