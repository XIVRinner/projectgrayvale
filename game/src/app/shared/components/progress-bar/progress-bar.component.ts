import { Component, computed, input } from "@angular/core";

import { ShellProgressBarTone } from "../../../layout/shell/shell.types";

@Component({
  selector: "gv-progress-bar",
  standalone: true,
  templateUrl: "./progress-bar.component.html",
  styleUrl: "./progress-bar.component.scss"
})
export class ProgressBarComponent {
  readonly label = input.required<string>();
  readonly valueLabel = input.required<string>();
  readonly current = input.required<number>();
  readonly max = input.required<number>();
  readonly detail = input("");
  readonly tone = input<ShellProgressBarTone>("neutral");

  protected readonly percent = computed(() => {
    const max = this.max();

    if (max <= 0) {
      return 0;
    }

    const ratio = (this.current() / max) * 100;

    return Math.max(0, Math.min(100, ratio));
  });
}