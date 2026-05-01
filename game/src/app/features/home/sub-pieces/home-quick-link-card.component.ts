import { Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";

import { HomeQuickLink } from "../home.types";

@Component({
  selector: "gv-home-quick-link-card",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./home-quick-link-card.component.html",
  styleUrl: "./home-quick-link-card.component.scss"
})
export class HomeQuickLinkCardComponent {
  readonly link = input.required<HomeQuickLink>();
}
