import type { Guard, GuardContext, GuardResolver } from "./guard.types";

export const evaluateGuard = (
  guard: Guard,
  context: GuardContext,
  resolver: GuardResolver
): boolean => resolver(guard, context);

export const evaluateGuards = (
  guards: Guard[] | undefined,
  context: GuardContext,
  resolver: GuardResolver
): boolean => {
  if (guards === undefined || guards.length === 0) {
    return true;
  }

  for (const guard of guards) {
    if (!evaluateGuard(guard, context, resolver)) {
      return false;
    }
  }

  return true;
};
