import { ComponentFixture, TestBed } from "@angular/core/testing";
import { computeStatBreakdown, type LabeledModifier } from "@rinner/grayvale-core";

import type { CombatStatRowView } from "./combat-stats.types";
import { CombatStatsViewComponent } from "./combat-stats-view.component";

const formatDelta = (base: number, final: number): string | null => {
  const delta = final - base;
  if (delta === 0) {
    return null;
  }

  return `${delta > 0 ? "+" : ""}${delta}`;
};

const toRow = (label: string, base: number, modifiers: readonly LabeledModifier[]): CombatStatRowView => {
  const breakdown = computeStatBreakdown(label.toLowerCase(), base, modifiers);

  return {
    key: breakdown.stat,
    label,
    breakdown,
    formattedValue: `${breakdown.final}`,
    formattedDelta: formatDelta(breakdown.base, breakdown.final)
  };
};

describe("CombatStatsViewComponent", () => {
  let fixture: ComponentFixture<CombatStatsViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatStatsViewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CombatStatsViewComponent);
    fixture.componentRef.setInput("isLoading", false);
    fixture.componentRef.setInput("error", null);
  });

  it("renders buffed and nerfed stat display states", () => {
    const buffedRow = toRow("Strength", 20, [
      {
        stat: "strength",
        type: "add",
        value: 20,
        source: "Bone-Carved Ring",
        category: "equipment",
        active: true
      }
    ]);
    const nerfedRow = toRow("Mentality", 30, [
      {
        stat: "mentality",
        type: "add",
        value: -20,
        source: "Bone-Carved Ring",
        category: "equipment",
        active: true
      }
    ]);

    fixture.componentRef.setInput("statGroups", [
      { label: "Primary Stats", stats: [buffedRow, nerfedRow] }
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll<HTMLElement>(".gv-stat-row"));

    expect(rows.find((row) => row.dataset["state"] === "buffed")?.textContent).toContain("Strength");
    expect(rows.find((row) => row.dataset["state"] === "buffed")?.textContent).toContain("+20");
    expect(rows.find((row) => row.dataset["state"] === "nerfed")?.textContent).toContain("Mentality");
    expect(rows.find((row) => row.dataset["state"] === "nerfed")?.textContent).toContain("-20");
  });

  it("shows equipment sources in the breakdown and excludes inactive modifiers from the final total", () => {
    const strengthBreakdown = computeStatBreakdown("strength", 20, [
      {
        stat: "strength",
        type: "add",
        value: 20,
        source: "Bone-Carved Ring",
        category: "equipment",
        active: true
      },
      {
        stat: "strength",
        type: "add",
        value: 5,
        source: "Dormant Warcry",
        category: "buff",
        active: false
      }
    ]);

    fixture.componentRef.setInput("statGroups", [
      {
        label: "Primary Stats",
        stats: [
          {
            key: "strength",
            label: "Strength",
            breakdown: strengthBreakdown,
            formattedValue: `${strengthBreakdown.final}`,
            formattedDelta: formatDelta(strengthBreakdown.base, strengthBreakdown.final)
          }
        ]
      }
    ]);
    fixture.componentRef.setInput("selectedKey", "strength");
    fixture.componentRef.setInput("selectedLabel", "Strength");
    fixture.componentRef.setInput("selectedBreakdown", strengthBreakdown);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector(".gv-breakdown-drawer")?.textContent).toContain("Bone-Carved Ring");
    expect(element.querySelector(".gv-breakdown-drawer")?.textContent).toContain("Dormant Warcry");
    expect(element.querySelector(".gv-breakdown-drawer__row--inactive")?.textContent).toContain("inactive");
    expect(element.querySelector(".gv-breakdown-drawer__row--final .gv-breakdown-drawer__value")?.textContent?.trim()).toBe(
      "40"
    );
  });
});
