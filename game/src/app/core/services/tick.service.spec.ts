import { TickService } from "./tick.service";

describe("TickService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("emits activity ticks once per second by default", () => {
    const service = new TickService();
    const received: number[] = [];

    service.registerTickType("activity");
    service.tick$("activity").subscribe((event) => {
      received.push(event.tickNumber);
    });

    service.start();

    jest.advanceTimersByTime(3100);

    expect(received).toEqual([1, 2, 3]);
    expect(service.heartbeatCount()).toBe(3);
  });

  it("supports independent rates for combat and gather tick types", () => {
    const service = new TickService();
    const combatTicks: number[] = [];
    const gatherTicks: number[] = [];

    service.registerTickType("combat", 2000);
    service.registerTickType("gather", 3000);

    service.tick$("combat").subscribe((event) => {
      combatTicks.push(event.tickNumber);
    });

    service.tick$("gather").subscribe((event) => {
      gatherTicks.push(event.tickNumber);
    });

    service.start();

    jest.advanceTimersByTime(7000);

    expect(combatTicks).toEqual([1, 2, 3]);
    expect(gatherTicks).toEqual([1, 2]);
  });

  it("applies updated rate for future ticks", () => {
    const service = new TickService();
    const received: number[] = [];

    service.registerTickType("activity", 1000);
    service.tick$("activity").subscribe((event) => {
      received.push(event.tickNumber);
    });

    service.start();

    jest.advanceTimersByTime(2000);
    service.setTickRate("activity", 3000);
    jest.advanceTimersByTime(2999);
    jest.advanceTimersByTime(1);

    expect(received).toEqual([1, 2, 3]);
  });

  it("stops emitting after stop is called", () => {
    const service = new TickService();
    const received: number[] = [];

    service.registerTickType("activity");
    service.tick$("activity").subscribe((event) => {
      received.push(event.tickNumber);
    });

    service.start();
    jest.advanceTimersByTime(2000);
    service.stop();
    jest.advanceTimersByTime(5000);

    expect(received).toEqual([1, 2]);
    expect(service.isRunning()).toBe(false);
  });
});
