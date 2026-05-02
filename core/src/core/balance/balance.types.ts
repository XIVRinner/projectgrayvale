export type BalanceScalarMap = Record<string, number>;

export type BalanceScalars = {
  attributes?: BalanceScalarMap;
  skills?: BalanceScalarMap;
  combat?: BalanceScalarMap;
  resources?: BalanceScalarMap;
};

export type ScalingOverride = {
  target: string;
  attribute: string;
  multiplier: number;
};

export type BalanceOverrides = {
  scaling?: ScalingOverride[];
};

export type BalanceProfile = {
  id: string;
  description?: string;
  scalars?: BalanceScalars;
  overrides?: BalanceOverrides;
};

export type BalanceScalarCategory = keyof BalanceScalars;
