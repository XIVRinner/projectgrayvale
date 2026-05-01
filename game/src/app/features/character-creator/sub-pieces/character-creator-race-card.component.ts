import { Component, input, output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";

import { CharacterCreatorRaceView } from "../character-creator.types";

@Component({
  selector: "gv-character-creator-race-card",
  imports: [ButtonModule, TooltipModule],
  templateUrl: "./character-creator-race-card.component.html",
  styleUrl: "./character-creator-race-card.component.scss"
})
export class CharacterCreatorRaceCardComponent {
  readonly entry = input.required<CharacterCreatorRaceView>();
  readonly selected = input.required<boolean>();

  readonly selectedRace = output<string>();
}
