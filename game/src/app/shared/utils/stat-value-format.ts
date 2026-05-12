export function formatCompactStatValue(value: number): string {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return formatLongStatValue(value);
}

export function formatLongStatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: resolveFractionDigits(value),
  }).format(value);
}

function resolveFractionDigits(value: number): number {
  const absoluteValue = Math.abs(value);

  if (absoluteValue < 1) {
    return 3;
  }

  if (absoluteValue < 100) {
    return 2;
  }

  if (absoluteValue < 1000) {
    return 1;
  }

  return 0;
}
