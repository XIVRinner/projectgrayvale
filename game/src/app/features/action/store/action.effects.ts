import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { HttpClient } from "@angular/common/http";
import { of } from "rxjs";
import { catchError, map, switchMap, withLatestFrom } from "rxjs/operators";
import { actionDefinitionSchema, type Delta } from "@rinner/grayvale-core";
import * as ActionActions from "./action.actions";
import { selectActionById, selectCurrentLocation, selectAvailableActions } from "./action.selectors";
import { ActionCostService } from "../services/action-cost.service";
import { CharacterRosterService } from "../../../core/services/character-roster.service";

@Injectable()
export class ActionEffects {
  private actions$ = inject(Actions);
  private http = inject(HttpClient);
  private store = inject(Store);
  private costService = inject(ActionCostService);
  private roster = inject(CharacterRosterService);

  loadActions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ActionActions.loadActions),
      switchMap(({ location }) =>
        this.http.get<unknown>("assets/data/actions.json").pipe(
          map((raw) => {
            const actions = actionDefinitionSchema.array().parse(raw);
            // Filter by location requirements
            const filtered = actions.filter(action => {
              if (!action.requirements?.location) return true;
              return action.requirements.location === location;
            });
            return ActionActions.loadActionsSuccess({ actions: filtered });
          }),
          catchError((error) =>
            of(
              ActionActions.loadActionsFailure({
                error: error.message || "Failed to load actions"
              })
            )
          )
        )
      )
    )
  );

  executeAction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ActionActions.executeAction),
      withLatestFrom(
        this.store.select(selectAvailableActions),
        this.store.select(selectCurrentLocation)
      ),
      switchMap(([{ actionId }, actions, location]) => {
        const actionDef = (actions as any[]).find((a: any) => a.id === actionId);
        
        if (!actionDef) {
          return of(
            ActionActions.executeActionFailure({
              error: `Action "${actionId}" not found`
            })
          );
        }

        const player = this.roster.activeCharacter();
        if (!player) {
          return of(
            ActionActions.executeActionFailure({
              error: "No active player character"
            })
          );
        }

        const health = this.roster.activeHealth();
        if (!health) {
          return of(
            ActionActions.executeActionFailure({
              error: "No active player health state"
            })
          );
        }

        // Calculate cost and check affordability
        const costResult = this.costService.calculateCost(
          actionDef,
          player,
          health.currentHp,
          health.maxHp
        );

        if (!costResult.affordable) {
          return of(
            ActionActions.executeActionFailure({
              error: `Cannot afford action. Cost: ${costResult.calculatedCost}, Have: ${player.inventory?.items?.["currency"] ?? 0}`
            })
          );
        }

        // Build deltas for cost deduction and effect application
        const deltas: Delta[] = [];

        // Deduct cost from currency
        const currentCurrency = (player.inventory?.items?.["currency"] as number) ?? 0;
        deltas.push({
          type: "set",
          target: "player",
          path: ["inventory", "items", "currency"],
          value: Math.max(0, currentCurrency - costResult.calculatedCost)
        });

        // Apply effect based on action type
        if (actionDef.effect) {
          const effectDeltas = this.generateEffectDeltas(actionDef.effect, player, health);
          deltas.push(...effectDeltas);
        }

        // Apply all deltas to player
        const applied = this.roster.applyActiveCharacterDeltas(deltas);
        
        if (!applied) {
          return of(
            ActionActions.executeActionFailure({
              error: "Failed to apply action effects to player"
            })
          );
        }

        return of(
          ActionActions.executeActionSuccess({
            actionId,
            result: {
              message: `${actionDef.name || actionId} executed successfully`,
              effect: actionDef.effect,
              costApplied: costResult.calculatedCost,
              breakdown: costResult.breakdown
            }
          })
        );
      }),
      catchError((error) =>
        of(
          ActionActions.executeActionFailure({
            error: error.message || "Action execution failed"
          })
        )
      )
    )
  );

  /**
   * Generate deltas for applying action effects to player state.
   * Handles: heal_full, restore_resource, grant_item, gain_experience, etc.
   * 
   * Note: heal_full is handled separately via updateActiveHealth since HP
   * is managed outside the delta system in SaveSlotHealthState.
   */
  private generateEffectDeltas(effect: any, player: any, health: any): Delta[] {
    const deltas: Delta[] = [];

    if (!effect || !effect.type) {
      return deltas;
    }

    switch (effect.type) {
      case "heal_full": {
        // Note: This effect requires a separate call to updateActiveHealth
        // Skipping in delta generation for now to keep to player state only
        break;
      }

      case "restore_resource": {
        // Restore a specific resource (mana, stamina, etc.)
        const resourceId = effect.resourceId || "mana";
        const maxAmount = effect.maxAmount ?? 100;
        deltas.push({
          type: "set",
          target: "player",
          path: ["progression", resourceId],
          value: maxAmount
        });
        break;
      }

      case "grant_item": {
        // Grant an item to player inventory
        const itemId = effect.itemId || "generic_item";
        const quantity = effect.quantity ?? 1;
        const currentQty = (player.inventory?.items?.[itemId] as number) ?? 0;
        deltas.push({
          type: "set",
          target: "player",
          path: ["inventory", "items", itemId],
          value: currentQty + quantity
        });
        break;
      }

      case "gain_experience": {
        // Award experience points
        const amount = effect.amount ?? 100;
        const currentXp = player.progression?.experience ?? 0;
        deltas.push({
          type: "set",
          target: "player",
          path: ["progression", "experience"],
          value: currentXp + amount
        });
        break;
      }

      // Add more effect types as needed
    }

    return deltas;
  }
}
