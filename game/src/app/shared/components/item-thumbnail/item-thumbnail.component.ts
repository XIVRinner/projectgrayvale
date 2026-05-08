import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";

@Component({
  selector: "gv-item-thumbnail",
  standalone: true,
  templateUrl: "./item-thumbnail.component.html",
  styleUrl: "./item-thumbnail.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemThumbnailComponent {
  readonly src = input<string | null>(null);
  readonly alt = input("Item artwork");
  readonly fallbackSrc = input("assets/images/no-texture.svg");

  private readonly brokenSrc = signal<string | null>(null);

  protected readonly resolvedSrc = computed(() =>
    this.brokenSrc() === this.src() ? this.fallbackSrc() : (this.src() ?? this.fallbackSrc())
  );

  protected onError(event: Event): void {
    const image = event.target as HTMLImageElement;

    if (image.currentSrc.endsWith(this.fallbackSrc()) || !this.src()) {
      return;
    }

    this.brokenSrc.set(this.src());
  }
}
