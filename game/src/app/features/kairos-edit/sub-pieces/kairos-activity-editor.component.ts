import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InputTextModule } from "primeng/inputtext";

import type { KairosFieldChange, KairosTagOption } from "../kairos-edit.types";
import {
  readOptionalNumberValue,
  readStringArrayValue,
  readStringValue,
} from "../kairos-edit.utils";
import { KairosRawJsonEditorComponent } from "./kairos-raw-json-editor.component";
import { KairosStringArrayFieldComponent } from "./kairos-string-array-field.component";
import { KairosTagMultiselectComponent } from "./kairos-tag-multiselect.component";

@Component({
  selector: "gv-kairos-activity-editor",
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    KairosRawJsonEditorComponent,
    KairosStringArrayFieldComponent,
    KairosTagMultiselectComponent,
  ],
  templateUrl: "./kairos-activity-editor.component.html",
  styleUrl: "./kairos-item-editor.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosActivityEditorComponent {
  readonly definition = input.required<Record<string, unknown>>();
  readonly tagOptions = input<readonly KairosTagOption[]>([]);
  readonly jsonText = input.required<string>();
  readonly jsonError = input<string | null>(null);

  readonly fieldChange = output<KairosFieldChange>();
  readonly jsonTextChange = output<string>();

  protected readString(path: readonly (string | number)[]): string {
    return readStringValue(this.definition(), path);
  }

  protected readNumber(path: readonly (string | number)[]): number | null {
    return readOptionalNumberValue(this.definition(), path);
  }

  protected readStringArray(path: readonly (string | number)[]): string[] {
    return readStringArrayValue(this.definition(), path);
  }

  protected update(path: readonly (string | number)[], value: unknown): void {
    this.fieldChange.emit({ path, value });
  }

  protected toNumber(value: unknown): number | undefined {
    if (value === "") {
      return undefined;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
}
