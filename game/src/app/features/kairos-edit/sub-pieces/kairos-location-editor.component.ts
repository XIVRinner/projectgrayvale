import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InputTextModule } from "primeng/inputtext";

import type { KairosFieldChange, KairosTagOption } from "../kairos-edit.types";
import {
  cloneDefinition,
  readBooleanValue,
  readPathValue,
  readStringArrayValue,
  readStringValue,
} from "../kairos-edit.utils";
import { KairosRawJsonEditorComponent } from "./kairos-raw-json-editor.component";
import { KairosStringArrayFieldComponent } from "./kairos-string-array-field.component";
import { KairosTagMultiselectComponent } from "./kairos-tag-multiselect.component";

@Component({
  selector: "gv-kairos-location-editor",
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    KairosRawJsonEditorComponent,
    KairosStringArrayFieldComponent,
    KairosTagMultiselectComponent,
  ],
  templateUrl: "./kairos-location-editor.component.html",
  styleUrl: "./kairos-item-editor.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosLocationEditorComponent {
  readonly definition = input.required<Record<string, unknown>>();
  readonly tagOptions = input<readonly KairosTagOption[]>([]);
  readonly jsonText = input.required<string>();
  readonly jsonError = input<string | null>(null);

  readonly fieldChange = output<KairosFieldChange>();
  readonly jsonTextChange = output<string>();

  protected readString(path: readonly (string | number)[]): string {
    return readStringValue(this.definition(), path);
  }

  protected readStringArray(path: readonly (string | number)[]): string[] {
    return readStringArrayValue(this.definition(), path);
  }

  protected readSublocations(): readonly Record<string, unknown>[] {
    const value = readPathValue(this.definition(), ["sublocations"]);
    return Array.isArray(value)
      ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      : [];
  }

  protected readBoolean(path: readonly (string | number)[]): boolean {
    return readBooleanValue(this.definition(), path);
  }

  protected update(path: readonly (string | number)[], value: unknown): void {
    this.fieldChange.emit({ path, value });
  }

  protected addSublocation(): void {
    const nextSublocations = this.readSublocations().map((entry) => cloneDefinition(entry));
    nextSublocations.push({
      id: "",
      label: "",
      subtitle: "",
      tags: [],
      availableNpcIds: [],
      isReturnable: true,
    });
    this.update(["sublocations"], nextSublocations);
  }

  protected removeSublocation(index: number): void {
    const nextSublocations = this.readSublocations()
      .map((entry) => cloneDefinition(entry))
      .filter((_, entryIndex) => entryIndex !== index);
    this.update(["sublocations"], nextSublocations);
  }
}
