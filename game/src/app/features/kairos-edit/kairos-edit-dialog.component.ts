import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TabsModule } from "primeng/tabs";

import { KairosEditService } from "./kairos-edit.service";
import {
  KAIROS_TABS,
  type KairosDefinitionType,
  type KairosEditorState,
  type KairosFieldChange,
  type KairosTagOption,
} from "./kairos-edit.types";
import {
  applyFieldChange,
  createDefaultDefinition,
  createEditorState,
  formatDefinitionJson,
  parseDefinitionJson,
  validateDefinitionDraft,
} from "./kairos-edit.utils";
import { KairosDefinitionWorkspaceComponent } from "./sub-pieces/kairos-definition-workspace.component";
import { KairosItemEditorComponent } from "./sub-pieces/kairos-item-editor.component";
import { KairosMaterialEditorComponent } from "./sub-pieces/kairos-material-editor.component";
import { KairosLocationEditorComponent } from "./sub-pieces/kairos-location-editor.component";
import { KairosActivityEditorComponent } from "./sub-pieces/kairos-activity-editor.component";
import { KairosActionEditorComponent } from "./sub-pieces/kairos-action-editor.component";

const EDITABLE_TYPES = [
  "items",
  "materials",
  "locations",
  "activities",
  "actions",
] as const satisfies readonly KairosDefinitionType[];

@Component({
  selector: "gv-kairos-edit-dialog",
  standalone: true,
  imports: [
    ButtonModule,
    DialogModule,
    TabsModule,
    KairosDefinitionWorkspaceComponent,
    KairosItemEditorComponent,
    KairosMaterialEditorComponent,
    KairosLocationEditorComponent,
    KairosActivityEditorComponent,
    KairosActionEditorComponent,
  ],
  templateUrl: "./kairos-edit-dialog.component.html",
  styleUrl: "./kairos-edit-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosEditDialogComponent {
  private readonly kairosEdit = inject(KairosEditService);

  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  protected readonly tabs = KAIROS_TABS;
  protected readonly activeTab = signal<(typeof KAIROS_TABS)[number]["id"]>("items");
  protected readonly editorStates = signal<Record<KairosDefinitionType, KairosEditorState>>({
    items: createEditorState(),
    materials: createEditorState(),
    locations: createEditorState(),
    activities: createEditorState(),
    actions: createEditorState(),
  });
  protected readonly tagOptions = signal<Record<KairosDefinitionType, readonly KairosTagOption[]>>({
    items: [],
    materials: [],
    locations: [],
    activities: [],
    actions: [],
  });
  private readonly initializedTypes = new Set<KairosDefinitionType>();
  private readonly loadedTagTypes = new Set<KairosDefinitionType>();
  private readonly ensureEditorReadyInFlight = new Set<KairosDefinitionType>();
  private readonly queuedEditorReadyTypes = new Set<KairosDefinitionType>();

  protected readonly currentEditorType = computed<KairosDefinitionType | null>(() => {
    const activeTab = this.activeTab();
    return activeTab === "tags" ? null : activeTab;
  });
  protected readonly currentEditorState = computed(() => {
    const type = this.currentEditorType();
    return type ? this.editorStates()[type] : null;
  });
  protected readonly currentTagOptions = computed(() => {
    const type = this.currentEditorType();
    return type ? this.tagOptions()[type] : [];
  });
  protected readonly currentWorkspaceView = computed(() => {
    const type = this.currentEditorType();

    if (!type) {
      return null;
    }

    const activeTab = this.tabs.find((tab) => tab.id === type);

    return {
      title: activeTab?.label ?? type,
      description: activeTab?.description ?? "",
      emptyLabel: `No ${type} definitions are available yet.`,
    };
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      const type = this.currentEditorType();

      if (type) {
        this.queueEnsureEditorReady(type);
      }
    });
  }

  protected setActiveTab(value: string | number | undefined): void {
    if (value === "tags") {
      this.activeTab.set("tags");
      return;
    }

    if (typeof value === "string" && EDITABLE_TYPES.includes(value as KairosDefinitionType)) {
      this.activeTab.set(value as KairosDefinitionType);
    }
  }

  protected closeDialog(): void {
    this.closed.emit();
  }

  protected createDefinition(type: KairosDefinitionType): void {
    const definition = createDefaultDefinition(type);
    this.setState(type, {
      ...this.editorStates()[type],
      selectedId: null,
      definition,
      jsonText: formatDefinitionJson(definition),
      jsonError: null,
      statusMessage: `New ${type} draft ready.`,
    });
  }

  protected reloadDefinitions(type: KairosDefinitionType): void {
    void this.refreshIds(type, true);
  }

  protected selectDefinition(type: KairosDefinitionType, id: string): void {
    void this.loadDefinition(type, id);
  }

  protected applyChange(type: KairosDefinitionType, change: KairosFieldChange): void {
    const state = this.editorStates()[type];

    if (!state.definition) {
      return;
    }

    const definition = applyFieldChange(state.definition, change);
    this.setState(type, {
      ...state,
      definition,
      jsonText: formatDefinitionJson(definition),
      jsonError: null,
      statusMessage: null,
    });
  }

  protected updateJsonText(type: KairosDefinitionType, value: string): void {
    const state = this.editorStates()[type];

    try {
      const definition = parseDefinitionJson(value);
      this.setState(type, {
        ...state,
        definition,
        jsonText: value,
        jsonError: null,
        statusMessage: null,
      });
    } catch (error) {
      this.setState(type, {
        ...state,
        jsonText: value,
        jsonError: error instanceof Error ? error.message : "Definition JSON is invalid.",
        statusMessage: null,
      });
    }
  }

  protected saveDefinition(type: KairosDefinitionType): void {
    void this.persistDefinition(type);
  }

  private async ensureEditorReady(type: KairosDefinitionType): Promise<void> {
    if (this.ensureEditorReadyInFlight.has(type)) {
      return;
    }

    this.ensureEditorReadyInFlight.add(type);

    try {
      await Promise.all([this.ensureTagOptions(type), this.refreshIds(type, !this.initializedTypes.has(type))]);
      this.initializedTypes.add(type);
    } finally {
      this.ensureEditorReadyInFlight.delete(type);
    }
  }

  private queueEnsureEditorReady(type: KairosDefinitionType): void {
    if (this.queuedEditorReadyTypes.has(type)) {
      return;
    }

    this.queuedEditorReadyTypes.add(type);
    queueMicrotask(() => {
      this.queuedEditorReadyTypes.delete(type);

      if (!this.open()) {
        return;
      }

      void this.ensureEditorReady(type);
    });
  }

  private async ensureTagOptions(type: KairosDefinitionType): Promise<void> {
    if (this.loadedTagTypes.has(type)) {
      return;
    }

    const options = await this.kairosEdit.getTagOptions(type);
    this.tagOptions.update((current) => ({
      ...current,
      [type]: options,
    }));
    this.setState(type, this.editorStates()[type]);
    this.loadedTagTypes.add(type);
  }

  private async refreshIds(type: KairosDefinitionType, autoSelect: boolean): Promise<void> {
    const state = this.editorStates()[type];
    this.setState(type, { ...state, loading: true, statusMessage: null });

    try {
      const ids = await this.kairosEdit.listIds(type);
      const nextState: KairosEditorState = {
        ...this.editorStates()[type],
        ids,
        loading: false,
        statusMessage: null,
      };
      this.setState(type, nextState);

      if (autoSelect && ids.length > 0) {
        await this.loadDefinition(type, ids[0]!);
      }
    } catch (error) {
      this.setState(type, {
        ...this.editorStates()[type],
        loading: false,
        statusMessage: error instanceof Error ? error.message : `Failed to load ${type}.`,
      });
    }
  }

  private async loadDefinition(type: KairosDefinitionType, id: string): Promise<void> {
    const state = this.editorStates()[type];
    this.setState(type, {
      ...state,
      loading: true,
      selectedId: id,
      statusMessage: null,
    });

    try {
      const definition = await this.kairosEdit.loadDefinition(type, id);
      this.setState(type, {
        ...this.editorStates()[type],
        loading: false,
        selectedId: id,
        definition,
        jsonText: formatDefinitionJson(definition),
        jsonError: null,
        statusMessage: `Loaded ${id}.`,
      });
    } catch (error) {
      this.setState(type, {
        ...this.editorStates()[type],
        loading: false,
        statusMessage: error instanceof Error ? error.message : `Failed to load ${id}.`,
      });
    }
  }

  private async persistDefinition(type: KairosDefinitionType): Promise<void> {
    const state = this.editorStates()[type];

    if (!state.definition) {
      return;
    }

    this.setState(type, {
      ...state,
      saving: true,
      statusMessage: null,
    });

    try {
      const definition = await this.kairosEdit.saveDefinition(
        type,
        state.definition,
        state.selectedId,
      );
      const ids = await this.kairosEdit.listIds(type);
      this.setState(type, {
        ...this.editorStates()[type],
        ids,
        selectedId: typeof definition["id"] === "string" ? definition["id"] : state.selectedId,
        definition,
        jsonText: formatDefinitionJson(definition),
        jsonError: null,
        saving: false,
        statusMessage: `Saved ${type} definition ${String(definition["id"] ?? "")}.`,
      });
    } catch (error) {
      this.setState(type, {
        ...this.editorStates()[type],
        saving: false,
        statusMessage: error instanceof Error ? error.message : `Failed to save ${type}.`,
      });
    }
  }

  private setState(type: KairosDefinitionType, nextState: KairosEditorState): void {
    const validation = validateDefinitionDraft(type, nextState, this.tagOptions()[type]);

    this.editorStates.update((current) => ({
      ...current,
      [type]: {
        ...nextState,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      },
    }));
  }
}
