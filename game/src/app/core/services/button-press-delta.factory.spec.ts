import { samplePlayer } from "@rinner/grayvale-core";

import { buildButtonPressDeltas } from "./button-press-delta.factory";
import { cloneSaveSlotWorldState } from "./world-state.models";

describe("buildButtonPressDeltas", () => {
  it("builds the mandatory interaction deltas for a gameplay button", () => {
    const player = clonePlayer(samplePlayer);
    delete player.interactionState;
    const world = cloneSaveSlotWorldState();

    const deltas = buildButtonPressDeltas(
      player,
      world,
      {
        actionId: "leave-chief-house",
        actionKind: "sublocation-exit",
        payload: {
          sublocationId: "chief-house"
        }
      },
      "2026-05-01T08:30:00.000Z"
    );

    expect(deltas).toEqual([
      {
        type: "add",
        target: "player",
        path: ["interactionState", "totalButtonPresses"],
        value: 1
      },
      {
        type: "set",
        target: "player",
        path: ["interactionState", "lastButtonPress"],
        value: {
          actionId: "leave-chief-house",
          actionKind: "sublocation-exit",
          occurredAt: "2026-05-01T08:30:00.000Z",
          locationId: "village-arkama",
          sublocationId: "chief-house",
          payload: {
            sublocationId: "chief-house"
          }
        }
      },
      {
        type: "set",
        target: "player",
        path: ["interactionState", "recentButtonPresses"],
        value: [
          {
            actionId: "leave-chief-house",
            actionKind: "sublocation-exit",
            occurredAt: "2026-05-01T08:30:00.000Z",
            locationId: "village-arkama",
            sublocationId: "chief-house",
            payload: {
              sublocationId: "chief-house"
            }
          }
        ]
      }
    ]);
  });

  it("caps recent button presses at fifty entries", () => {
    const player = clonePlayer(samplePlayer);
    player.interactionState = {
      totalButtonPresses: 50,
      recentButtonPresses: Array.from({ length: 50 }, (_, index) => ({
        actionId: `action-${index + 1}`,
        actionKind: "world-travel",
        occurredAt: `2026-05-01T08:${String(index).padStart(2, "0")}:00.000Z`,
        locationId: "village-arkama"
      }))
    };

    const deltas = buildButtonPressDeltas(
      player,
      cloneSaveSlotWorldState({
        currentLocation: "camp",
        sublocations: []
      }),
      {
        actionId: "travel-camp-to-village-arkama",
        actionKind: "world-travel"
      },
      "2026-05-01T09:00:00.000Z"
    );
    const recentDelta = deltas[2];

    if (!recentDelta || recentDelta.type !== "set" || !Array.isArray(recentDelta.value)) {
      throw new Error("Expected recent button presses delta.");
    }

    expect(recentDelta.value).toHaveLength(50);
    expect(recentDelta.value[0]).toMatchObject({ actionId: "action-2" });
    expect(recentDelta.value.at(-1)).toMatchObject({
      actionId: "travel-camp-to-village-arkama",
      locationId: "camp"
    });
  });
});

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
