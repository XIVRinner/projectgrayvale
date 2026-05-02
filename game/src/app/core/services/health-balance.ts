import { type BalanceProfile, type Player } from "@rinner/grayvale-core";

export interface SaveSlotHealthState {
  readonly currentHp: number;
  readonly maxHp: number;
}

export const PLAYER_HEALTH_BALANCE_PROFILE_ID = "player_health_v1";

const VITALITY_ATTRIBUTE_ID = "vitality";
const MAX_HP_FLAT_KEY = "maxHpFlat";

export function reconcileHealthState(
  player: Player,
  existing: SaveSlotHealthState | undefined,
  profile: BalanceProfile | undefined
): SaveSlotHealthState {
  const maxHp = calculateMaxHp(player, profile);
  const currentHp = existing
    ? clamp(Math.round(existing.currentHp), 0, maxHp)
    : maxHp;

  return {
    currentHp,
    maxHp
  };
}

export function healthStatesEqual(
  left: SaveSlotHealthState | undefined,
  right: SaveSlotHealthState | undefined
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.currentHp === right.currentHp && left.maxHp === right.maxHp;
}

function calculateMaxHp(player: Player, profile: BalanceProfile | undefined): number {
  const vitality = player.attributes[VITALITY_ATTRIBUTE_ID] ?? 0;
  const vitalityScalar = getBalanceScalar(profile, "attributes", VITALITY_ATTRIBUTE_ID);
  const flatModifier = profile?.scalars?.resources?.[MAX_HP_FLAT_KEY] ?? 0;

  return Math.max(0, Math.round(flatModifier + vitality * vitalityScalar));
}

function getBalanceScalar(
  profile: BalanceProfile | undefined,
  category: "attributes" | "skills" | "combat" | "resources",
  key: string
): number {
  return profile?.scalars?.[category]?.[key] ?? 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
