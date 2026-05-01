import {
  LocationRouter,
  type LifecycleEvent,
  type WorldGraph,
  type WorldState
} from "../index";

const createGraph = (): WorldGraph => ({
  locations: {
    town: {
      id: "town",
      sublocations: ["square", "inn"]
    },
    forest: {
      id: "forest",
      sublocations: ["grove"]
    }
  },
  edges: [
    {
      from: "town",
      to: "forest"
    }
  ]
});

const createState = (): WorldState => ({
  currentLocation: "town",
  sublocations: []
});

describe("LocationRouter", () => {
  it("emits a new state when movement is valid", () => {
    const router = new LocationRouter(createGraph(), createState());
    const states: WorldState[] = [];
    const subscription = router.getState$().subscribe((state) => {
      states.push(state);
    });

    router.moveTo("forest");

    expect(states).toEqual([
      {
        currentLocation: "town",
        sublocations: []
      },
      {
        currentLocation: "forest",
        sublocations: []
      }
    ]);
    expect(router.getSnapshot()).toEqual({
      currentLocation: "forest",
      sublocations: []
    });

    subscription.unsubscribe();
  });

  it("emits lifecycle events in leave then enter order on movement", () => {
    const router = new LocationRouter(createGraph(), createState());
    const events: LifecycleEvent[] = [];
    const subscription = router.getLifecycle$().subscribe((event) => {
      events.push(event);
    });

    router.moveTo("forest");

    expect(events).toEqual([
      {
        type: "onLeave",
        locationId: "town",
        sublocations: []
      },
      {
        type: "onEnter",
        locationId: "forest",
        sublocations: []
      }
    ]);

    subscription.unsubscribe();
  });

  it("does nothing for invalid movement", () => {
    const router = new LocationRouter(createGraph(), createState());
    const states: WorldState[] = [];
    const subscription = router.getState$().subscribe((state) => {
      states.push(state);
    });

    router.moveTo("unknown");

    expect(states).toEqual([
      {
        currentLocation: "town",
        sublocations: []
      }
    ]);
    expect(router.getSnapshot()).toEqual({
      currentLocation: "town",
      sublocations: []
    });

    subscription.unsubscribe();
  });

  it("emits updates for sublocation enter and leave", () => {
    const router = new LocationRouter(createGraph(), createState());
    const states: WorldState[] = [];
    const subscription = router.getState$().subscribe((state) => {
      states.push(state);
    });

    router.enterSublocation("square");
    router.enterSublocation("fountain");
    router.leaveSublocation();

    expect(states).toEqual([
      {
        currentLocation: "town",
        sublocations: []
      },
      {
        currentLocation: "town",
        sublocations: ["square"]
      },
      {
        currentLocation: "town",
        sublocations: ["square", "fountain"]
      },
      {
        currentLocation: "town",
        sublocations: ["square"]
      }
    ]);
    expect(router.getSnapshot()).toEqual({
      currentLocation: "town",
      sublocations: ["square"]
    });

    subscription.unsubscribe();
  });

  it("emits lifecycle events for sublocation enter and leave", () => {
    const router = new LocationRouter(createGraph(), createState());
    const events: LifecycleEvent[] = [];
    const subscription = router.getLifecycle$().subscribe((event) => {
      events.push(event);
    });

    router.enterSublocation("square");
    router.leaveSublocation();

    expect(events).toEqual([
      {
        type: "onEnter",
        locationId: "town",
        sublocations: ["square"]
      },
      {
        type: "onLeave",
        locationId: "town",
        sublocations: ["square"]
      }
    ]);

    subscription.unsubscribe();
  });

  it("does not emit leave events when leaving an empty sublocation stack", () => {
    const router = new LocationRouter(createGraph(), createState());
    const events: LifecycleEvent[] = [];
    const subscription = router.getLifecycle$().subscribe((event) => {
      events.push(event);
    });

    router.leaveSublocation();

    expect(events).toEqual([]);

    subscription.unsubscribe();
  });

  it("keeps snapshot aligned with the observable state", () => {
    const router = new LocationRouter(createGraph(), createState());
    let latestState: WorldState | undefined;
    const subscription = router.getState$().subscribe((state) => {
      latestState = state;
    });

    router.enterSublocation("inn");

    expect(router.getSnapshot()).toBe(latestState);

    subscription.unsubscribe();
  });
});
