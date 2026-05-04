import { Injectable, OnDestroy, computed, signal } from "@angular/core";
import { Observable, Subject } from "rxjs";

export type TickType = "activity" | "combat" | "gather" | string;

export type TickEvent = {
  readonly type: TickType;
  readonly tickNumber: number;
  readonly elapsedMs: number;
  readonly at: number;
};

type TickChannelState = {
  readonly type: TickType;
  rateMs: number;
  elapsedMs: number;
  tickCount: number;
  readonly events: Subject<TickEvent>;
};

@Injectable({ providedIn: "root" })
export class TickService implements OnDestroy {
  private readonly channels = new Map<TickType, TickChannelState>();
  private readonly baseIntervalMs = 1000;

  private readonly isRunningState = signal(false);
  private readonly startedAtState = signal<number | null>(null);
  private readonly heartbeatCountState = signal(0);

  private timerId: ReturnType<typeof setInterval> | null = null;
  private lastPulseAt: number | null = null;

  readonly isRunning = computed(() => this.isRunningState());
  readonly heartbeatCount = computed(() => this.heartbeatCountState());
  readonly startedAt = computed(() => this.startedAtState());

  start(): void {
    if (this.timerId !== null) {
      return;
    }

    this.startedAtState.set(Date.now());
    this.lastPulseAt = this.startedAtState();
    this.isRunningState.set(true);

    this.timerId = setInterval(() => {
      this.pulse();
    }, this.baseIntervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.isRunningState.set(false);
    this.lastPulseAt = null;
  }

  ngOnDestroy(): void {
    this.stop();

    for (const channel of this.channels.values()) {
      channel.events.complete();
    }

    this.channels.clear();
  }

  registerTickType(type: TickType, rateMs = 1000): void {
    if (this.channels.has(type)) {
      return;
    }

    this.channels.set(type, {
      type,
      rateMs: normalizeRate(rateMs),
      elapsedMs: 0,
      tickCount: 0,
      events: new Subject<TickEvent>()
    });
  }

  setTickRate(type: TickType, rateMs: number): void {
    const channel = this.getOrCreateChannel(type);
    channel.rateMs = normalizeRate(rateMs);
    channel.elapsedMs = 0;
  }

  getTickRate(type: TickType): number {
    return this.getOrCreateChannel(type).rateMs;
  }

  tick$(type: TickType): Observable<TickEvent> {
    return this.getOrCreateChannel(type).events.asObservable();
  }

  pulse(now = Date.now()): void {
    const previous = this.lastPulseAt ?? now;
    const elapsedMs = Math.max(0, now - previous);

    this.lastPulseAt = now;
    this.heartbeatCountState.update((count) => count + 1);

    for (const channel of this.channels.values()) {
      channel.elapsedMs += elapsedMs;

      while (channel.elapsedMs >= channel.rateMs) {
        channel.elapsedMs -= channel.rateMs;
        channel.tickCount += 1;

        channel.events.next({
          type: channel.type,
          tickNumber: channel.tickCount,
          elapsedMs: channel.rateMs,
          at: now
        });
      }
    }
  }

  private getOrCreateChannel(type: TickType): TickChannelState {
    const existing = this.channels.get(type);

    if (existing) {
      return existing;
    }

    const created: TickChannelState = {
      type,
      rateMs: 1000,
      elapsedMs: 0,
      tickCount: 0,
      events: new Subject<TickEvent>()
    };

    this.channels.set(type, created);
    return created;
  }
}

function normalizeRate(rateMs: number): number {
  if (!Number.isFinite(rateMs) || rateMs < 1) {
    throw new Error("Tick rate must be a finite number greater than 0.");
  }

  return Math.floor(rateMs);
}
