export type LifecycleEvent = {
  type: "onEnter" | "onLeave";
  locationId: string;
  sublocations: string[];
};
