import { samplePlayer } from "@rinner/grayvale-core";

import {
  healthStatesEqual,
  reconcileHealthState,
  type SaveSlotHealthState
} from "./health-balance";

describe("reconcileHealthState", () => {
  it("uses a flat modifier plus vitality scaling when building max HP", () => {
    const player = clonePlayer(samplePlayer);

    expect(
      reconcileHealthState(player, undefined, {
        id: "player_health_v1",
        scalars: {
          attributes: {
            vitality: 4
          },
          resources: {
            maxHpFlat: 20
          }
        }
      })
    ).toEqual({
      currentHp: 60,
      maxHp: 60
    });
  });

  it("clamps persisted current HP to the recalculated max HP", () => {
    const player = clonePlayer(samplePlayer);
    const existing: SaveSlotHealthState = {
      currentHp: 999,
      maxHp: 999
    };

    expect(
      reconcileHealthState(player, existing, {
        id: "player_health_v1",
        scalars: {
          attributes: {
            vitality: 3
          },
          resources: {
            maxHpFlat: 10
          }
        }
      })
    ).toEqual({
      currentHp: 40,
      maxHp: 40
    });
  });
});

describe("healthStatesEqual", () => {
  it("compares health snapshots structurally", () => {
    expect(
      healthStatesEqual(
        {
          currentHp: 20,
          maxHp: 30
        },
        {
          currentHp: 20,
          maxHp: 30
        }
      )
    ).toBe(true);

    expect(
      healthStatesEqual(
        {
          currentHp: 19,
          maxHp: 30
        },
        {
          currentHp: 20,
          maxHp: 30
        }
      )
    ).toBe(false);
  });
});

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
