export interface ActivityTickSnapshotView {
  readonly id: string;
  readonly activityId: string;
  readonly activityLabel: string;
  readonly tickNumber: number;
  readonly occurredAtLabel: string;
  readonly attributeSkillDeltaLabel: string;
  readonly currentAttributeSkillLevelLabel: string;
  readonly attributeSkillPerHourLabel: string;
  readonly itemGainLabel: string;
  readonly itemTotalGainLabel: string;
  readonly cutoffRuleLabel: string;
  readonly isCutoffTriggered: boolean;
}
