import { Injectable, inject } from "@angular/core";
import { MessageService } from "primeng/api";

export type ToastVariant =
  | "level-up"
  | "friend-request"
  | "guild-invite"
  | "skill-unlock"
  | "attribute-unlock"
  | "game-updated"
  | "achievement-earned";

export type ToastPosition = "top-right" | "bottom-center";

export interface ToastPayload {
  title: string;
  message: string;
}

interface ToastVariantConfig {
  readonly position: ToastPosition;
  readonly lifeMs: number;
  readonly severity: "info" | "success" | "warn";
}

interface ToastInstance {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly payload: ToastPayload;
  readonly config: ToastVariantConfig;
}

interface ToastQueueState {
  active: ToastInstance | null;
  queue: ToastInstance[];
  timerId: ReturnType<typeof setTimeout> | null;
}

const MAX_QUEUE_PER_POSITION = 50;

const TOAST_VARIANT_CONFIG: Readonly<Record<ToastVariant, ToastVariantConfig>> = {
  "level-up": { position: "bottom-center", lifeMs: 5200, severity: "success" },
  "friend-request": { position: "top-right", lifeMs: 9000, severity: "info" },
  "guild-invite": { position: "top-right", lifeMs: 9000, severity: "info" },
  "skill-unlock": { position: "bottom-center", lifeMs: 3800, severity: "success" },
  "attribute-unlock": { position: "bottom-center", lifeMs: 4200, severity: "success" },
  "game-updated": { position: "top-right", lifeMs: 6500, severity: "info" },
  "achievement-earned": { position: "bottom-center", lifeMs: 5600, severity: "success" },
};

@Injectable({ providedIn: "root" })
export class ToastService {
  private readonly messageService = inject(MessageService);

  private nextId = 1;

  private readonly states: Record<ToastPosition, ToastQueueState> = {
    "top-right": { active: null, queue: [], timerId: null },
    "bottom-center": { active: null, queue: [], timerId: null },
  };

  show(variant: ToastVariant, payload: ToastPayload): void {
    const config = TOAST_VARIANT_CONFIG[variant];
    const instance: ToastInstance = {
      id: this.nextId++,
      variant,
      payload,
      config,
    };

    const state = this.states[config.position];

    if (!state.active) {
      this.display(config.position, instance);
      return;
    }

    if (state.queue.length >= MAX_QUEUE_PER_POSITION) {
      state.queue.shift();
    }

    state.queue.push(instance);
  }

  showLevelUp(payload: ToastPayload): void {
    this.show("level-up", payload);
  }

  showFriendRequest(payload: ToastPayload): void {
    this.show("friend-request", payload);
  }

  showGuildInvite(payload: ToastPayload): void {
    this.show("guild-invite", payload);
  }

  showSkillUnlock(payload: ToastPayload): void {
    this.show("skill-unlock", payload);
  }

  showAttributeUnlock(payload: ToastPayload): void {
    this.show("attribute-unlock", payload);
  }

  showGameUpdated(payload: ToastPayload): void {
    this.show("game-updated", payload);
  }

  showAchievementEarned(payload: ToastPayload): void {
    this.show("achievement-earned", payload);
  }

  private display(position: ToastPosition, instance: ToastInstance): void {
    const state = this.states[position];
    state.active = instance;

    this.messageService.add(this.toPrimeMessage(instance));

    if (state.timerId !== null) {
      clearTimeout(state.timerId);
    }

    state.timerId = setTimeout(() => {
      this.completeActive(position, instance.id);
    }, instance.config.lifeMs);
  }

  private completeActive(position: ToastPosition, id: number): void {
    const state = this.states[position];

    if (!state.active || state.active.id !== id) {
      return;
    }

    this.messageService.clear(position);
    state.active = null;

    if (state.timerId !== null) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }

    const next = state.queue.shift();

    if (next) {
      this.display(position, next);
    }
  }

  private toPrimeMessage(instance: ToastInstance) {
    return {
      key: instance.config.position,
      severity: instance.config.severity,
      summary: instance.payload.title,
      detail: instance.payload.message,
      life: instance.config.lifeMs,
      closable: false,
      styleClass: `gv-toast gv-toast--${instance.variant}`,
    };
  }
}
