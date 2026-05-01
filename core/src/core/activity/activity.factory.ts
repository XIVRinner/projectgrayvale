import type { Activity } from "./activity.types";

const freezeActivity = (activity: Activity): Activity => {
  if (activity.payload) {
    Object.freeze(activity.payload);
  }

  return Object.freeze(activity);
};

export const createActivity = (
  type: string,
  payload?: Record<string, unknown>
): Activity => {
  if (payload === undefined) {
    return freezeActivity({ type });
  }

  return freezeActivity({
    type,
    payload: { ...payload }
  });
};
