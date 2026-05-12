import { Component, input, output } from "@angular/core";

@Component({
  selector: "gv-whats-new-button",
  standalone: true,
  templateUrl: "./whats-new-button.component.html",
  styleUrl: "./whats-new-button.component.scss",
})
export class WhatsNewButtonComponent {
  readonly unreadCount = input(0);
  readonly opened = output<void>();
}
