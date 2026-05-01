import { BehaviorSubject, Subject, type Observable } from "rxjs";

import {
  canMove,
  enterSublocation,
  leaveSublocation,
  move
} from "../world-graph/graph.logic";
import type { WorldGraph, WorldState } from "../world-graph/graph.types";
import type { LifecycleEvent } from "./lifecycle.types";

export class LocationRouter {
  private readonly state$: BehaviorSubject<WorldState>;
  private readonly lifecycle$: Subject<LifecycleEvent>;

  public constructor(
    private readonly graph: WorldGraph,
    initialState: WorldState
  ) {
    this.state$ = new BehaviorSubject<WorldState>({
      currentLocation: initialState.currentLocation,
      sublocations: [...initialState.sublocations]
    });
    this.lifecycle$ = new Subject<LifecycleEvent>();
  }

  public getState$(): Observable<WorldState> {
    return this.state$.asObservable();
  }

  public getLifecycle$(): Observable<LifecycleEvent> {
    return this.lifecycle$.asObservable();
  }

  public getSnapshot(): WorldState {
    return this.state$.getValue();
  }

  public moveTo(to: string): void {
    const state = this.state$.getValue();

    if (!canMove(this.graph, state.currentLocation, to)) {
      return;
    }

    this.lifecycle$.next({
      type: "onLeave",
      locationId: state.currentLocation,
      sublocations: [...state.sublocations]
    });

    const nextState = move(state, to);

    this.state$.next(nextState);
    this.lifecycle$.next({
      type: "onEnter",
      locationId: nextState.currentLocation,
      sublocations: [...nextState.sublocations]
    });
  }

  public enterSublocation(id: string): void {
    const nextState = enterSublocation(this.state$.getValue(), id);

    this.state$.next(nextState);
    this.lifecycle$.next({
      type: "onEnter",
      locationId: nextState.currentLocation,
      sublocations: [...nextState.sublocations]
    });
  }

  public leaveSublocation(): void {
    const state = this.state$.getValue();

    if (state.sublocations.length === 0) {
      return;
    }

    this.lifecycle$.next({
      type: "onLeave",
      locationId: state.currentLocation,
      sublocations: [...state.sublocations]
    });

    this.state$.next(leaveSublocation(state));
  }
}
