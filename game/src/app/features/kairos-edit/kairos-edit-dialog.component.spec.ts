import { ComponentFixture, TestBed } from "@angular/core/testing";

import { KairosEditDialogComponent } from "./kairos-edit-dialog.component";
import { KairosEditService } from "./kairos-edit.service";

describe("KairosEditDialogComponent", () => {
  let fixture: ComponentFixture<KairosEditDialogComponent>;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver
    });
  });

  it("loads the active editor only once when opening the dialog", async () => {
    const kairosEdit = {
      getTagOptions: jest.fn(async () => []),
      listDefinitionListItems: jest.fn(async () => [
        {
          id: "armor_boots_travel_rags",
          label: "Travel Rags",
          tags: [],
        },
      ]),
      loadDefinition: jest.fn(async () => ({
        id: "armor_boots_travel_rags",
        name: "Travel Rags",
        category: "equipment",
        rarity: "common",
        tags: [],
        slot: "boots",
        itemLevel: 1
      }))
    } as Pick<KairosEditService, "getTagOptions" | "listIds" | "loadDefinition">;

    await TestBed.configureTestingModule({
      imports: [KairosEditDialogComponent],
      providers: [{ provide: KairosEditService, useValue: kairosEdit }]
    }).compileComponents();

    fixture = TestBed.createComponent(KairosEditDialogComponent);
    fixture.componentRef.setInput("open", true);
    fixture.detectChanges();

    await flushComponentEffects(fixture);
    await flushComponentEffects(fixture);

    expect(kairosEdit.getTagOptions).toHaveBeenCalledTimes(1);
    expect(kairosEdit.listDefinitionListItems).toHaveBeenCalledTimes(1);
    expect(kairosEdit.loadDefinition).toHaveBeenCalledTimes(1);
    expect(kairosEdit.loadDefinition).toHaveBeenCalledWith(
      "items",
      "armor_boots_travel_rags"
    );
  });
});

async function flushComponentEffects(
  fixture: ComponentFixture<KairosEditDialogComponent>
): Promise<void> {
  TestBed.flushEffects();
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
}
