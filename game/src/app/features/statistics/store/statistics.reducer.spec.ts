import { statisticsReducer } from "./statistics.reducer";
import { initialStatisticsState } from "./statistics.state";
import * as StatisticsActions from "./statistics.actions";

describe("statisticsReducer", () => {
  it("ingests an atomic fact once by deterministic idempotency key", () => {
    const withDefinitions = statisticsReducer(
      initialStatisticsState,
      StatisticsActions.loadStatisticsDefinitionsSuccess({
        definitions: [
          {
            factType: "dungeon.cleared",
            scope: "character",
            aggregation: "counter",
            initialValue: 0
          }
        ]
      })
    );

    const fact = {
      factType: "dungeon.cleared",
      scope: "character" as const,
      scopeId: "char-1",
      sourceActionId: "run-42",
      sequence: 0,
      occurredAt: new Date().toISOString(),
      value: 1
    };

    const once = statisticsReducer(withDefinitions, StatisticsActions.atomicFactIngested({ fact }));
    const twice = statisticsReducer(once, StatisticsActions.atomicFactIngested({ fact }));

    const valueKeys = Object.keys(twice.values);
    expect(valueKeys).toHaveLength(1);
    expect(twice.values[valueKeys[0]]?.value).toBe(1);
  });
});
