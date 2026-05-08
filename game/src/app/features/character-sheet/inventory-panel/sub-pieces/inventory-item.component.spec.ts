import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  sampleEquipmentItem,
  sampleJunkItem,
  sampleMaterialItem,
  sampleQuestItem,
  type InventoryItemDefinition
} from "@rinner/grayvale-core";

import type { InventoryPanelItemView } from "../inventory-panel.types";
import { InventoryItemComponent } from "./inventory-item.component";

const createBaseItemView = (itemDef: InventoryItemDefinition) => ({
  id: itemDef.id,
  name: itemDef.name,
  category: itemDef.category,
  rarity: itemDef.rarity,
  searchTerms: [itemDef.name.toLowerCase()],
  itemDef
} satisfies Pick<InventoryPanelItemView, "id" | "name" | "category" | "rarity" | "searchTerms" | "itemDef">);

const toItemView = (itemDef: InventoryItemDefinition): InventoryPanelItemView => {
  const base = createBaseItemView(itemDef);

  switch (itemDef.category) {
    case "equipment":
      return {
        ...base,
        itemTypeLabel: `Equipment · ${itemDef.slot.replace("_", " ")}`,
        quantity: null,
        qualityStars: null,
        itemLevel: itemDef.itemLevel,
        slot: itemDef.slot,
        inspectTooltip: itemDef.name,
        compareSummary: "Slot empty",
        isEquipped: false,
        canEquip: true,
        equipDisabledReason: null
      };
    case "material":
      return {
        ...base,
        itemTypeLabel: "Material",
        quantity: itemDef.quantity,
        qualityStars: itemDef.qualityStars ?? null,
        itemLevel: null,
        slot: null,
        inspectTooltip: itemDef.name,
        compareSummary: null,
        isEquipped: false,
        canEquip: false,
        equipDisabledReason: null
      };
    case "quest_item":
      return {
        ...base,
        itemTypeLabel: "Quest Item",
        quantity: null,
        qualityStars: null,
        itemLevel: null,
        slot: null,
        inspectTooltip: itemDef.name,
        compareSummary: null,
        isEquipped: false,
        canEquip: false,
        equipDisabledReason: null
      };
    case "junk":
      return {
        ...base,
        itemTypeLabel: "Junk",
        quantity: null,
        qualityStars: null,
        itemLevel: null,
        slot: null,
        inspectTooltip: itemDef.name,
        compareSummary: null,
        isEquipped: false,
        canEquip: false,
        equipDisabledReason: null
      };
  }
};

describe("InventoryItemComponent", () => {
  let fixture: ComponentFixture<InventoryItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryItemComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryItemComponent);
    fixture.componentRef.setInput("isCompared", false);
  });

  it("emits a comparison request for equipment items", () => {
    fixture.componentRef.setInput("item", toItemView(sampleEquipmentItem));
    fixture.detectChanges();

    const emitSpy = jest.spyOn(fixture.componentInstance.compareRequested, "emit");
    fixture.nativeElement.querySelector<HTMLButtonElement>("[aria-label^='Compare ']")?.click();

    expect(emitSpy).toHaveBeenCalledWith(sampleEquipmentItem.id);
  });

  it("renders material quantity and quality stars", () => {
    fixture.componentRef.setInput("item", toItemView(sampleMaterialItem));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(".gv-inventory-item__details")?.textContent).toContain("Qty 10");
    expect(element.querySelector(".gv-inventory-item__quality-stars")?.textContent).toContain("★★");
  });

  it("uses the quest tooltip family for quest items", () => {
    fixture.componentRef.setInput("item", toItemView(sampleQuestItem));
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector(".gv-inventory-item") as HTMLElement;
    host.dispatchEvent(new Event("mouseenter"));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(".gv-quest-tooltip-body")).not.toBeNull();
    expect(element.querySelector(".gv-junk-tooltip-body")).toBeNull();
  });

  it("uses the junk tooltip family for junk items", () => {
    fixture.componentRef.setInput("item", toItemView(sampleJunkItem));
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector(".gv-inventory-item") as HTMLElement;
    host.dispatchEvent(new Event("mouseenter"));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(".gv-junk-tooltip-body")).not.toBeNull();
    expect(element.querySelector(".gv-quest-tooltip-body")).toBeNull();
  });

  it("disables equip when requirements are not met", () => {
    fixture.componentRef.setInput("item", {
      ...toItemView(sampleEquipmentItem),
      canEquip: false,
      equipDisabledReason: "Requires level 99."
    });
    fixture.detectChanges();

    const equipButton = fixture.nativeElement.querySelector<HTMLButtonElement>("[aria-label^='Equip ']");

    expect(equipButton?.disabled).toBe(true);
  });
});
