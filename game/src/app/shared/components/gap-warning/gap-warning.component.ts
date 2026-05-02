import { Component, computed, input } from "@angular/core";

@Component({
  selector: "gv-gap-warning",
  standalone: true,
  templateUrl: "./gap-warning.component.html",
  styleUrl: "./gap-warning.component.scss"
})
export class GapWarningComponent {
  readonly title = input.required<string>();
  readonly blockedOn = input<string | readonly string[]>("");
  readonly needs = input<string | readonly string[]>("");
  readonly doNotImplementUntil = input<string | readonly string[]>("");
  readonly note = input<string | null>(null);
  readonly label = input("GAP");

  protected readonly blockedOnLines = computed(() => toLines(this.blockedOn()));
  protected readonly needsLines = computed(() => toLines(this.needs()));
  protected readonly doNotImplementUntilLines = computed(() => toLines(this.doNotImplementUntil()));
}

function toLines(value: string | readonly string[]): readonly string[] {
  if (typeof value === "string") {
    return value.trim().length > 0 ? [value] : [];
  }

  return value.filter((entry) => entry.trim().length > 0);
}
