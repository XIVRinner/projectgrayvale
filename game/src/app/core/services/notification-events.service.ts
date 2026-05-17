import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface NotificationEventPayload {
  readonly eventType: string;
  readonly actorName?: string;
  readonly achievementName?: string;
  readonly message?: string;
}

@Injectable({ providedIn: "root" })
export class NotificationEventsService {
  private readonly subject = new Subject<NotificationEventPayload>();

  readonly events$ = this.subject.asObservable();

  emit(event: NotificationEventPayload): void {
    this.subject.next(event);
  }
}
