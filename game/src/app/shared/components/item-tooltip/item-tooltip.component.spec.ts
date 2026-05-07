import { ComponentFixture, TestBed } from "@angular/core/testing";

jest.mock(
  "@rinner/grayvale-core",
  () => ({
    RARITY_DEFINITIONS: {
      legendary: { color: "#f59e0b" }
    }
  }),
  { virtual: true }
);

import { ItemTooltipComponent } from "./item-tooltip.component";

const BASE_ITEM = {
  id: "item_test_blade",
  name: "Test Blade",
  category: "equipment",
  rarity: "legendary",
  tags: ["blade"],
  slot: "main_hand",
  itemLevel: 12
} as const;

describe("ItemTooltipComponent", () => {
  let fixture: ComponentFixture<ItemTooltipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemTooltipComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ItemTooltipComponent);
    fixture.componentRef.setInput("item", BASE_ITEM);
  });

  it("renders legendary+ section from base rarity input", () => {
    fixture.componentRef.setInput("baseRarity", "primal");
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(".gv-item-tooltip__focus-section--legendary")?.textContent).toContain(
      "Primal Bonus"
    );
  });

  it("renders multiple special rarity badges and section details", () => {
    fixture.componentRef.setInput("specialRarities", ["cursed", "phantom", "temporal", "galvanized"]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll(".gv-item-tooltip__special-rarity").length).toBe(4);
    expect(element.textContent).toContain("Cursed");
    expect(element.textContent).toContain("Phantom");
    expect(element.textContent).toContain("Temporal");
    expect(element.textContent).toContain("Galvanized");
    expect(element.querySelector(".gv-item-tooltip")?.getAttribute("data-critical-special")).toBe("true");
  });
});
