export * from "./activity";
export * from "./balance";
export * from "./delta";
export * from "./equipment";
export * from "./modifiers";
export * from "./models";
export * from "./npc";
export * from "./quest";
export * from "./race";
export * from "./story";
export * from "./talent";
export * from "./combat";
// Explicit re-export resolves the EquipmentSlot ambiguity between the legacy equipment
// module (camelCase slot names) and the combat domain model (snake_case slot names).
// The combat module's EquipmentSlot is the canonical definition going forward.
export type { EquipmentSlot } from "./combat/combat.equipment";
