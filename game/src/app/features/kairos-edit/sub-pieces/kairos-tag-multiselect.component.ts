import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MultiSelectModule } from "primeng/multiselect";

import type { KairosTagOption } from "../kairos-edit.types";

@Component({
  selector: "gv-kairos-tag-multiselect",
  standalone: true,
  imports: [FormsModule, MultiSelectModule],
  templateUrl: "./kairos-tag-multiselect.component.html",
  styleUrl: "./kairos-tag-multiselect.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosTagMultiselectComponent {
  readonly options = input<readonly KairosTagOption[]>([]);
  readonly value = input<readonly string[]>([]);

  readonly valueChange = output<readonly string[]>();

  protected readonly mutableOptions = computed(() => {
    const knownOptions = [...this.options()];
    const knownIds = new Set(knownOptions.map((option) => option.id.toLowerCase()));
    const missingOptions = this.value()
      .filter((tag) => !knownIds.has(tag.toLowerCase()))
      .map((tag) => ({
        id: tag,
        label: `${tag} (missing from registry)`,
        description: "Unknown tag currently present in the definition.",
        categoryId: "missing",
        categoryLabel: "Missing",
      }));

    return [...knownOptions, ...missingOptions];
  });
}
