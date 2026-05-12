import { Component, OnInit, inject } from "@angular/core";
import { Store } from "@ngrx/store";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActionViewComponent } from "./action-view.component";
import {
  selectAvailableActionsForLocation,
  selectActionExecuting,
  selectActionLoading,
  selectActionError,
  loadActions,
  executeAction
} from "./store";

@Component({
  selector: "gv-action-container",
  standalone: true,
  imports: [ActionViewComponent],
  template: `
    <gv-action-view
      [actions]="availableActions() || []"
      [loading]="loading() || false"
      [executing]="executing() || false"
      [error]="error() ?? null"
      (selectAction)="onSelectAction($event)"
    />
  `
})
export class ActionContainerComponent implements OnInit {
  private store = inject(Store);

  readonly availableActions = toSignal(
    this.store.select(selectAvailableActionsForLocation),
    { initialValue: [] }
  );
  readonly loading = toSignal(this.store.select(selectActionLoading), {
    initialValue: false
  });
  readonly executing = toSignal(this.store.select(selectActionExecuting), {
    initialValue: false
  });
  readonly error = toSignal(this.store.select(selectActionError), {
    initialValue: null
  });

  ngOnInit(): void {
    this.store.dispatch(loadActions({ location: "tavern" }));
  }

  onSelectAction(actionId: string): void {
    this.store.dispatch(executeAction({ actionId }));
  }
}
