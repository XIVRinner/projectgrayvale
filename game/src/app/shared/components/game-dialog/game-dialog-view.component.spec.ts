import { ComponentFixture, TestBed } from "@angular/core/testing";

import { GameDialogViewComponent } from "./game-dialog-view.component";

describe("GameDialogViewComponent", () => {
  let fixture: ComponentFixture<GameDialogViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameDialogViewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GameDialogViewComponent);
    fixture.componentRef.setInput("sceneImagePath", "assets/images/location-backgrounds/prologue.png");
    fixture.componentRef.setInput("transcript", [
      {
        id: "entry-1",
        kind: "narration",
        actor: null,
        text: "Pain drags you back to the world one pulse at a time."
      },
      {
        id: "entry-2",
        kind: "say",
        actor: {
          id: "village-chief",
          name: "Village Chief",
          title: "Chief of Arkama",
          portraitPath: "assets/images/dialogue-heads/village-chief.png"
        },
        text: "Easy now. You are safe enough."
      }
    ]);
    fixture.componentRef.setInput("currentEntry", {
      id: "entry-2",
      kind: "say",
      actor: {
        id: "village-chief",
        name: "Village Chief",
        title: "Chief of Arkama",
        portraitPath: "assets/images/dialogue-heads/village-chief.png"
      },
      text: "Easy now. You are safe enough."
    });
    fixture.componentRef.setInput("choices", [
      {
        index: 0,
        label: "Open your eyes"
      }
    ]);
    fixture.componentRef.setInput("canAdvance", false);
    fixture.detectChanges();
  });

  it("renders the current speaker, transcript, scene art, and choice list", () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector(".gv-game-dialog-view__speaker-name")?.textContent).toContain(
      "Village Chief"
    );
    expect(element.querySelector(".gv-game-dialog-view__scene img")?.getAttribute("src")).toBe(
      "assets/images/location-backgrounds/prologue.png"
    );
    expect(element.querySelectorAll(".gv-game-dialog-view__entry").length).toBe(2);
    expect(element.querySelector(".gv-game-dialog-view__choice")?.textContent).toContain(
      "Open your eyes"
    );
  });
});
