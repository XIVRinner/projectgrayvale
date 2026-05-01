export type MilestoneId = string;

export type Milestone = {
  id: MilestoneId;
  order?: number;
  required?: boolean;
  dependsOn?: MilestoneId[];
};

export type ChapterMilestones = {
  milestones: Milestone[];
};
