import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface ActionItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly cost?: {
    readonly type: string;
    readonly base: number;
    readonly factors?: readonly {
      readonly source: string;
      readonly multiplier: number;
    }[];
  };
  readonly effect?: {
    readonly type: string;
    readonly meta?: Record<string, unknown>;
  };
  readonly requirements?: {
    readonly minLevel?: number;
    readonly location?: string;
  };
}

@Component({
  selector: "gv-action-view",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gv-actions">
      <div *ngIf="loading" class="gv-actions__loading">Loading actions...</div>
      <div *ngIf="error" class="gv-actions__error">{{ error }}</div>
      <div *ngIf="!loading && (actions || []).length === 0" class="gv-actions__empty">
        No actions available
      </div>
      <div class="gv-actions__list">
        <button
          *ngFor="let action of actions || []"
          class="gv-action-item"
          [disabled]="executing"
          (click)="selectAction.emit(getActionId(action))"
          type="button"
        >
          <span class="gv-action-item__name">{{ getActionName(action) }}</span>
          <span class="gv-action-item__desc" *ngIf="getActionDescription(action)">{{ getActionDescription(action) }}</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ["./action-view.component.scss"]
})
export class ActionViewComponent {
  @Input() actions: readonly unknown[] = [];
  @Input() loading = false;
  @Input() executing = false;
  @Input() error: string | null = null;

  @Output() selectAction = new EventEmitter<string>();

  getActionId(action: unknown): string {
    return (action as any)?.id || "";
  }

  getActionName(action: unknown): string {
    return (action as any)?.name || "";
  }

  getActionDescription(action: unknown): string {
    return (action as any)?.description || "";
  }
}
