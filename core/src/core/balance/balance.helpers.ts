import type {
  BalanceProfile,
  BalanceScalarCategory,
  ScalingOverride
} from "./balance.types";

export const getScalar = (
  profile: BalanceProfile | undefined,
  category: BalanceScalarCategory,
  key: string
): number => profile?.scalars?.[category]?.[key] ?? 1;

export const findScalingOverride = (
  profile: BalanceProfile | undefined,
  target: string,
  attribute: string
): ScalingOverride | undefined =>
  profile?.overrides?.scaling?.find(
    (override) => override.target === target && override.attribute === attribute
  );
