import { Component, input, output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";

import { CharacterCreatorClassView } from "../character-creator.types";

@Component({
  selector: "gv-character-creator-class-card",
  imports: [ButtonModule, TooltipModule],
  templateUrl: "./character-creator-class-card.component.html",
  styleUrl: "./character-creator-class-card.component.scss"
})
export class CharacterCreatorClassCardComponent {
  readonly entry = input.required<CharacterCreatorClassView>();
  readonly selected = input.required<boolean>();

  readonly selectedClass = output<string>();
}
