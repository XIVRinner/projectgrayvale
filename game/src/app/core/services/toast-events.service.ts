import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import type { GameLogEntry } from "./game-log/log-mapper";
import type { ToastPayload, ToastVariant } from "./toast.service";

export interface ToastEvent {
  readonly variant: ToastVariant;
  readonly payload: ToastPayload;
  readonly logEntry?: GameLogEntry;
  readonly debugScope?: string;
}

@Injectable({ providedIn: "root" })
export class ToastEventsService {
  private readonly toastEventSubject = new Subject<ToastEvent>();

  readonly toastEvents$ = this.toastEventSubject.asObservable();

  emit(event: ToastEvent): void {
    this.toastEventSubject.next(event);
  }
}
