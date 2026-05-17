import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { of } from "rxjs";
import { catchError, filter, map, switchMap, tap, withLatestFrom } from "rxjs/operators";

import { AchievementDefinitionsLoader } from "../../../data/loaders/achievement-definitions.loader";
import { NotificationEventsService } from "../../../core/services/notification-events.service";
import { StatisticsDefinitionsLoader } from "../../../data/loaders/statistics-definitions.loader";
import { createStatisticKey } from "./statistics-aggregator";
import * as StatisticsActions from "./statistics.actions";
import { selectAchievementDefinitions, selectEarnedAchievementKeys, selectStatisticsValues } from "./statistics.selectors";

@Injectable()
export class StatisticsEffects {
  private readonly actions$ = inject(Actions);
  private readonly loader = inject(StatisticsDefinitionsLoader);
  private readonly achievementLoader = inject(AchievementDefinitionsLoader);
  private readonly store = inject(Store);
  private readonly notifications = inject(NotificationEventsService);

  init$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      switchMap(() => [
        StatisticsActions.loadStatisticsDefinitions(),
        StatisticsActions.loadAchievementDefinitions()
      ])
    )
  );

  loadDefinitions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatisticsActions.loadStatisticsDefinitions),
      switchMap(() =>
        this.loader.load().pipe(
          map((definitions) => StatisticsActions.loadStatisticsDefinitionsSuccess({ definitions })),
          catchError((error: Error) =>
            of(
              StatisticsActions.loadStatisticsDefinitionsFailure({
                error: error.message || "Failed to load statistics definitions"
              })
            )
          )
        )
      )
    )
  );

  loadAchievementDefinitions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatisticsActions.loadAchievementDefinitions),
      switchMap(() =>
        this.achievementLoader.load().pipe(
          map((definitions) => StatisticsActions.loadAchievementDefinitionsSuccess({ definitions })),
          catchError((error: Error) =>
            of(
              StatisticsActions.loadAchievementDefinitionsFailure({
                error: error.message || "Failed to load achievement definitions"
              })
            )
          )
        )
      )
    )
  );

  emitAchievementNotifications$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StatisticsActions.atomicFactIngested),
        withLatestFrom(
          this.store.select(selectStatisticsValues),
          this.store.select(selectAchievementDefinitions),
          this.store.select(selectEarnedAchievementKeys)
        ),
        switchMap(([{ fact }, values, achievementDefinitions, earnedAchievementKeys]) => {
          const statisticKey = createStatisticKey(fact.factType, fact.scope, fact.scopeId);
          const currentValue = values[statisticKey]?.value ?? 0;

          const achievements = achievementDefinitions
            .filter((entry) => entry.scope === fact.scope && entry.statisticFactType === fact.factType)
            .filter((entry) => currentValue >= entry.threshold)
            .filter((entry) => !earnedAchievementKeys.has(`${entry.achievementId}::${fact.scopeId}`))
            .sort((a, b) => a.threshold - b.threshold);

          return achievements.map((entry) =>
            StatisticsActions.achievementEarnedRecorded({
              earnedKey: `${entry.achievementId}::${fact.scopeId}`
            })
          );
        }),
        filter((action) => !!action),
        tap((action) => {
          if (!action) {
            return;
          }

          const earnedKey = action.earnedKey;
          const achievementId = earnedKey.split("::")[0] ?? "achievement";
          this.notifications.emit({
            eventType: "achievement.earned",
            achievementName: achievementId,
            message: `Achievement earned: ${achievementId}`
          });
        })
      ),
    { dispatch: true }
  );
}
