import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { MultiSelectModule } from "primeng/multiselect";
import { TabsModule } from "primeng/tabs";

import { KairosEditService } from "./kairos-edit.service";
import {
  KAIROS_TABS,
  TAG_TARGET_OPTIONS,
  type KairosDefinitionType,
  type KairosEditorState,
  type KairosFieldChange,
  type KairosTagRegistry,
  type KairosTagRegistryCategory,
  type KairosTagRegistryTag,
  type KairosTagTarget,
  type KairosTagOption,
} from "./kairos-edit.types";
import {
  applyFieldChange,
  createDefaultDefinition,
  createEditorState,
  formatDefinitionJson,
  parseDefinitionJson,
  validateDefinitionDraft,
  validateTagRegistryDraft,
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
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
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
  protected readonly tagTargetOptions = TAG_TARGET_OPTIONS;
  protected readonly tagRegistry = signal<KairosTagRegistry | null>(null);
  protected readonly tagRegistryLoading = signal(false);
  protected readonly tagRegistrySaving = signal(false);
  protected readonly tagRegistryStatusMessage = signal<string | null>(null);
  protected readonly selectedTagCategoryId = signal<string | null>(null);
  protected readonly tagRegistryValidation = computed(() =>
    validateTagRegistryDraft(this.tagRegistry()),
  );
  protected readonly selectedTagCategory = computed<KairosTagRegistryCategory | null>(() => {
    const categoryId = this.selectedTagCategoryId();
    const registry = this.tagRegistry();
    if (!categoryId || !registry) {
      return null;
    }

    return registry.categories.find((category) => category.id === categoryId) ?? null;
  });
  private readonly initializedTypes = new Set<KairosDefinitionType>();
  private readonly loadedTagTypes = new Set<KairosDefinitionType>();
  private tagRegistryLoaded = false;
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

    effect(() => {
      if (!this.open() || this.activeTab() !== "tags" || this.tagRegistryLoaded) {
        return;
      }

      void this.loadTagRegistry();
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

  protected reloadTagRegistry(): void {
    void this.loadTagRegistry(true);
  }

  protected selectTagCategory(categoryId: string): void {
    this.selectedTagCategoryId.set(categoryId);
  }

  protected addTagCategory(): void {
    const registry = this.tagRegistry();
    if (!registry) {
      return;
    }

    const nextCategory: KairosTagRegistryCategory = {
      id: "",
      label: "",
      description: "",
      allowedFor: ["items"],
      tags: [],
    };
    const nextRegistry: KairosTagRegistry = {
      categories: [...registry.categories, nextCategory],
    };
    this.tagRegistry.set(nextRegistry);
    this.selectedTagCategoryId.set(nextCategory.id);
    this.tagRegistryStatusMessage.set(null);
  }

  protected updateSelectedCategoryField(
    field: "id" | "label" | "description",
    value: string,
  ): void {
    const category = this.selectedTagCategory();
    const registry = this.tagRegistry();
    if (!category || !registry) {
      return;
    }

    const updatedCategory = { ...category, [field]: value };
    this.replaceCategory(updatedCategory);
  }

  protected updateSelectedCategoryAllowedFor(values: readonly string[]): void {
    const category = this.selectedTagCategory();
    const registry = this.tagRegistry();
    if (!category || !registry) {
      return;
    }

    const allowedFor = values.filter(
      (value): value is KairosTagTarget =>
        this.tagTargetOptions.some((option) => option.value === value),
    );
    this.replaceCategory({ ...category, allowedFor });
  }

  protected addTagToSelectedCategory(): void {
    const category = this.selectedTagCategory();
    if (!category) {
      return;
    }

    const updatedCategory: KairosTagRegistryCategory = {
      ...category,
      tags: [...category.tags, { id: "", label: "", description: "" }],
    };
    this.replaceCategory(updatedCategory);
  }

  protected updateTagField(
    tagIndex: number,
    field: "id" | "label" | "description",
    value: string,
  ): void {
    const category = this.selectedTagCategory();
    if (!category) {
      return;
    }

    const nextTags = category.tags.map((tag, index) =>
      index === tagIndex ? ({ ...tag, [field]: value } satisfies KairosTagRegistryTag) : tag,
    );
    this.replaceCategory({ ...category, tags: nextTags });
  }

  protected removeTag(tagIndex: number): void {
    const category = this.selectedTagCategory();
    if (!category) {
      return;
    }

    this.replaceCategory({
      ...category,
      tags: category.tags.filter((_, index) => index !== tagIndex),
    });
  }

  protected saveTagRegistry(): void {
    void this.persistTagRegistry();
  }

  private replaceCategory(updatedCategory: KairosTagRegistryCategory): void {
    const registry = this.tagRegistry();
    const selectedCategory = this.selectedTagCategory();
    const selectedCategoryId = this.selectedTagCategoryId();
    if (!registry) {
      return;
    }

    const previousCategoryId = selectedCategoryId ?? "";
    const nextRegistry: KairosTagRegistry = {
      categories: registry.categories.map((category) =>
        category === selectedCategory ? updatedCategory : category,
      ),
    };
    this.tagRegistry.set(nextRegistry);
    this.selectedTagCategoryId.set(updatedCategory.id || previousCategoryId);
    this.tagRegistryStatusMessage.set(null);
  }

  private async loadTagRegistry(force = false): Promise<void> {
    if (this.tagRegistryLoading() || (!force && this.tagRegistryLoaded)) {
      return;
    }

    this.tagRegistryLoading.set(true);
    this.tagRegistryStatusMessage.set(null);

    try {
      const registry = await this.kairosEdit.getTagRegistry();
      this.tagRegistry.set(registry);
      this.tagRegistryLoaded = true;
      if (registry.categories.length > 0) {
        this.selectedTagCategoryId.set(registry.categories[0]?.id ?? null);
      } else {
        this.selectedTagCategoryId.set(null);
      }
      this.tagRegistryStatusMessage.set("Tag registry loaded.");
    } catch (error) {
      this.tagRegistryStatusMessage.set(
        error instanceof Error ? error.message : "Failed to load tag registry.",
      );
    } finally {
      this.tagRegistryLoading.set(false);
    }
  }

  private async persistTagRegistry(): Promise<void> {
    const registry = this.tagRegistry();
    if (!registry) {
      return;
    }

    const validation = validateTagRegistryDraft(registry);
    if (validation.errors.length > 0) {
      this.tagRegistryStatusMessage.set("Fix tag registry validation errors before saving.");
      return;
    }

    this.tagRegistrySaving.set(true);
    this.tagRegistryStatusMessage.set(null);

    try {
      const saved = await this.kairosEdit.saveTagRegistry(registry);
      this.tagRegistry.set(saved);
      this.loadedTagTypes.clear();
      this.tagRegistryStatusMessage.set("Tag registry saved.");
    } catch (error) {
      this.tagRegistryStatusMessage.set(
        error instanceof Error ? error.message : "Failed to save tag registry.",
      );
    } finally {
      this.tagRegistrySaving.set(false);
    }
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
      const listItems = await this.kairosEdit.listDefinitionListItems(type);
      const ids = listItems.map((item) => item.id);
      const nextState: KairosEditorState = {
        ...this.editorStates()[type],
        ids,
        listItems,
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
      const listItems = await this.kairosEdit.listDefinitionListItems(type);
      const ids = listItems.map((item) => item.id);
      this.setState(type, {
        ...this.editorStates()[type],
        ids,
        listItems,
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
