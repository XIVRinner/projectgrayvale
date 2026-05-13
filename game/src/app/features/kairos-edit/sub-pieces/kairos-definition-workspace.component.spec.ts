import { ComponentFixture, TestBed } from "@angular/core/testing";

import { KairosDefinitionWorkspaceComponent } from "./kairos-definition-workspace.component";

describe("KairosDefinitionWorkspaceComponent", () => {
  let fixture: ComponentFixture<KairosDefinitionWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KairosDefinitionWorkspaceComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(KairosDefinitionWorkspaceComponent);
    fixture.componentRef.setInput("view", {
      title: "Items",
      description: "Manage items.",
      emptyLabel: "No items.",
    });
    fixture.componentRef.setInput("listItems", [
      {
        id: "weapon_dagger_rustleaf",
        label: "Old Dagger",
        tags: ["starter", "weapon"],
      },
    ]);
    fixture.detectChanges();
  });

  it("renders display labels and tags instead of raw ids", () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain("Old Dagger");
    expect(root.textContent).toContain("starter");
    expect(root.textContent).toContain("weapon");
    expect(root.querySelector(".gv-kairos-workspace__list-item-title")?.textContent).toContain(
      "Old Dagger",
    );
    expect(root.querySelectorAll(".gv-kairos-workspace__list-chip")).toHaveLength(2);
  });
});
