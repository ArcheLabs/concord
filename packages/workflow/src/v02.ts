import type {
  ActorId,
  ArtifactRef,
  ObjectRef,
  OrganizationId,
  ProjectId,
  SubmissionId,
  TaskId,
  Timestamp,
} from "@vibly-ai/concord-foundation";
import type {
  Artifact,
  AssignmentOffer,
  AssignmentTimeout,
  Observation,
  ObservationTask,
  ReviewRound,
  Task,
  TaskPlan,
  VotingRound,
} from "@vibly-ai/concord-core";

export type {
  Artifact,
  AssignmentOffer,
  AssignmentTimeout,
  Observation,
  ObservationTask,
  ReviewRound,
  Task,
  TaskPlan,
  VotingRound,
};

export interface Submission {
  id: SubmissionId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  taskId: TaskId;
  submittedBy: ActorId;
  targetRef: ObjectRef<"task">;
  artifacts: ArtifactRef[];
  summary: string;
  submittedAt: Timestamp;
}
