import { ComponentFixture, TestBed } from "@angular/core/testing";
import { computeStatBreakdown, type LabeledModifier } from "@rinner/grayvale-core";

import { CombatStatsViewComponent } from "./combat-stats-view.component";

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
    const buffedBreakdown = computeStatBreakdown("strength", 20, [
      {
        stat: "strength",
        type: "add",
        value: 20,
        source: "Bone-Carved Ring",
        category: "equipment",
        active: true
      }
    ]);
    const nerfedBreakdown = computeStatBreakdown("mentality", 30, [
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
      {
        label: "Primary Stats",
        stats: [
          {
            key: "strength",
            label: "Strength",
            breakdown: buffedBreakdown,
            formattedValue: "40",
            formattedDelta: "+20"
          },
          {
            key: "mentality",
            label: "Mentality",
            breakdown: nerfedBreakdown,
            formattedValue: "10",
            formattedDelta: "-20"
          }
        ]
      }
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
            formattedDelta: "+20"
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
