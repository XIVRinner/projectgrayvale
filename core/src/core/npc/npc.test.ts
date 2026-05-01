import {
  assertValidNPC,
  getTrustThreshold,
  isCombatNPC,
  isNonCombatNPC,
  type NPC
} from "./index";

const createCombatNPC = (): NPC => ({
  id: "npc_combat_1",
  name: "Lysa",
  description: "A disciplined frontline adventurer.",
  visual: {
    default: "assets/npc/lysa/default.png",
    dialogueHead: "assets/npc/lysa/dialogue.png",
    eventImages: {
      trustUp: "assets/npc/lysa/trust-up.png"
    }
  },
  type: "combat",
  skills: {
    swordsmanship: 4
  },
  attributes: {
    strength: 8,
    vitality: 6
  },
  progression: {
    level: 10,
    adventurerRank: 3
  },
  trust: 40,
  trustCap: 100,
  starLevel: 1,
  role: "tank",
  availableRoles: ["tank", "dps"],
  equipment: {
    mainHand: "iron_sword",
    offHand: "tower_shield",
    head: "iron_helm"
  },
  raceId: "race_human",
  talents: ["talent_vanguard"]
});

const createNonCombatNPC = (): NPC => ({
  id: "npc_noncombat_1",
  name: "Mira",
  description: "A traveling quartermaster with a sharp memory.",
  visual: {
    default: "assets/npc/mira/default.png"
  },
  type: "noncombat",
  skills: {
    bargaining: 5
  },
  attributes: {
    insight: 7
  },
  progression: {
    level: 6,
    adventurerRank: 2
  },
  affection: 10,
  trust: 90,
  trustCap: 100,
  starLevel: 1,
  bonus: "shop_discount",
  talents: ["talent_tradecraft"]
});

describe("npc structure", () => {
  it("accepts a valid combat NPC", () => {
    const npc = createCombatNPC();

    expect(isCombatNPC(npc)).toBe(true);
    expect(isNonCombatNPC(npc)).toBe(false);
    expect(() => assertValidNPC(npc)).not.toThrow();
  });

  it("accepts a valid non-combat NPC", () => {
    const npc = createNonCombatNPC();

    expect(isCombatNPC(npc)).toBe(false);
    expect(isNonCombatNPC(npc)).toBe(true);
    expect(() => assertValidNPC(npc)).not.toThrow();
  });

  it("supports missing optional fields", () => {
    const npc: NPC = {
      id: "npc_combat_2",
      name: "Rook",
      visual: {
        default: "assets/npc/rook/default.png"
      },
      type: "combat",
      skills: {},
      attributes: {},
      progression: {
        level: 1,
        adventurerRank: 1
      },
      trust: 0,
      trustCap: 100,
      starLevel: 1
    };

    expect(() => assertValidNPC(npc)).not.toThrow();
  });

  it("fails when role is not included in availableRoles", () => {
    const npc: NPC = {
      ...createCombatNPC(),
      role: "healer",
      availableRoles: ["tank", "dps"]
    };

    expect(() => assertValidNPC(npc)).toThrow(
      "NPC role must be included in availableRoles."
    );
  });

  it("fails when a non-combat NPC declares availableRoles", () => {
    const npc: NPC = {
      ...createNonCombatNPC(),
      availableRoles: ["healer"]
    };

    expect(() => assertValidNPC(npc)).toThrow(
      "availableRoles is only valid for combat NPCs."
    );
  });

  it("fails when a non-combat NPC declares equipment", () => {
    const npc: NPC = {
      ...createNonCombatNPC(),
      equipment: {
        mainHand: "ledger"
      }
    };

    expect(() => assertValidNPC(npc)).toThrow(
      "equipment is only valid for combat NPCs."
    );
  });
});

describe("npc visual structure", () => {
  it("supports default, dialogue, and event image references", () => {
    const npc = createCombatNPC();

    expect(npc.visual.default).toBe("assets/npc/lysa/default.png");
    expect(npc.visual.dialogueHead).toBe("assets/npc/lysa/dialogue.png");
    expect(npc.visual.eventImages?.trustUp).toBe("assets/npc/lysa/trust-up.png");
  });
});

describe("npc trust", () => {
  it("calculates the expected threshold values", () => {
    expect(getTrustThreshold(1)).toBe(100);
    expect(getTrustThreshold(2)).toBe(200);
    expect(getTrustThreshold(3)).toBe(400);
  });

  it("scales exponentially by doubling each star level", () => {
    expect(getTrustThreshold(4)).toBe(800);
    expect(getTrustThreshold(5)).toBe(getTrustThreshold(4) * 2);
  });

  it("rejects invalid star levels", () => {
    expect(() => getTrustThreshold(0)).toThrow(RangeError);
    expect(() => getTrustThreshold(1.5)).toThrow(RangeError);
  });
});
