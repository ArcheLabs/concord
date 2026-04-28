import { sha256, type ArtifactRef, type DecisionRecordId, type Hash, type Version, type Timestamp } from "@concord/foundation";
import type {
  AgentId,
  BoundaryId,
  CapabilityId,
  MembershipId,
  ObjectiveId,
  PrincipalId,
  ProjectBootstrapId,
  ProjectId,
  RuntimeBindingId,
  AddressBindingId,
} from "@concord/foundation";
import type { ConcordRole, DecisionFlow, StateView } from "@concord/core";

export type {
  AgentId,
  BoundaryId,
  CapabilityId,
  MembershipId,
  ObjectiveId,
  PrincipalId,
  ProjectBootstrapId,
  ProjectId,
  RuntimeBindingId,
  AddressBindingId,
};

export type ProjectStatus = "draft" | "active" | "paused" | "archived";
export type ObjectiveKind = "long_term" | "milestone" | "phase" | "task_cluster" | "experiment";
export type ObjectiveStatus = "draft" | "active" | "succeeded" | "failed" | "superseded" | "abandoned";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PrincipalKind = "human" | "organization" | "service" | "multisig" | "unknown";
export type PrincipalStatus = "pending" | "active" | "suspended" | "revoked";
export type AgentStatus = "pending" | "active" | "paused" | "suspended" | "retired";
export type RuntimeKind = "script" | "mock" | "local_llm" | "browser_llm" | "openclaw" | "a2a" | "mcp" | "hosted_agent" | "human_assisted";
export type RuntimeBindingStatus = "active" | "paused" | "revoked";
export type MembershipStatus = "invited" | "active" | "suspended" | "left" | "removed";

export interface ProjectProtocolConfig {
  version: Version;
  traceRequired: boolean;
}

export interface ProjectGovernanceConfig {
  reference?: ArtifactRef;
  mode?: "manual" | "external";
}

export interface ProjectIncentiveConfig {
  reference?: ArtifactRef;
  mode?: "none" | "manual" | "external";
}

export interface Project {
  id: ProjectId;
  slug: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  sponsorPrincipalId: PrincipalId;
  primaryObjectiveId?: ObjectiveId;
  boundaryId: BoundaryId;
  bootstrapId?: ProjectBootstrapId;
  currentStateViewId?: StateView["id"];
  currentKnowledgeVersionId?: string;
  protocol: ProjectProtocolConfig;
  governance?: ProjectGovernanceConfig;
  incentive?: ProjectIncentiveConfig;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
}

export interface ObjectiveTimebox {
  startsAt?: Timestamp;
  targetAt?: Timestamp;
  endsAt?: Timestamp;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  verificationMethod: "human_review" | "agent_review" | "state_observation" | "governance_receipt" | "knowledge_commit" | "manual";
  required: boolean;
}

export interface Objective {
  id: ObjectiveId;
  projectId: ProjectId;
  parentObjectiveId?: ObjectiveId;
  title: string;
  description: string;
  kind: ObjectiveKind;
  status: ObjectiveStatus;
  timebox?: ObjectiveTimebox;
  successCriteria: AcceptanceCriterion[];
  forbiddenOutcomes?: string[];
  priority?: number;
  createdBy: PrincipalId | AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp;
}

export interface BoundaryCondition {
  expression: string;
  language: "jsonlogic" | "cel" | "manual";
}

export interface BoundaryActionRule {
  id: string;
  actionType: string;
  effect: "allow" | "deny";
  reason: string;
  condition?: BoundaryCondition;
}

export interface BoundaryRiskRule {
  id: string;
  actionType: string;
  riskLevel: RiskLevel;
  reason: string;
  condition?: BoundaryCondition;
}

export interface BoundaryEscalationRule {
  id: string;
  actionType: string;
  requiredFlow: Extract<DecisionFlow, "direct" | "delegate_vote" | "structured_negotiation" | "guardian_review" | "governance_request">;
  reason: string;
  condition?: BoundaryCondition;
}

export interface BoundaryPermissionRule {
  id: string;
  subject: { kind: "role"; role: ConcordRole } | { kind: "agent"; agentId: AgentId } | { kind: "principal"; principalId: PrincipalId };
  actionType: string;
  effect: "allow" | "deny";
  reason: string;
}

export interface Boundary {
  id: BoundaryId;
  projectId: ProjectId;
  version: Version;
  status: "draft" | "active" | "superseded";
  description?: string;
  prohibitedActions: BoundaryActionRule[];
  riskRules: BoundaryRiskRule[];
  escalationRules: BoundaryEscalationRule[];
  permissionRules: BoundaryPermissionRule[];
  defaultRiskLevel: RiskLevel;
  createdBy: PrincipalId | AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  supersededBy?: BoundaryId;
}

export interface IdentityBinding {
  namespace: string;
  subject: string;
  proof?: ArtifactRef;
  verifiedAt?: Timestamp;
}

export interface AddressBinding {
  id: AddressBindingId;
  chain: string;
  address: string;
  publicKey?: string;
  proof?: ArtifactRef;
  status: "pending" | "verified" | "revoked";
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
  revokedAt?: Timestamp;
}

export interface PrincipalOperatorInfo {
  label?: string;
  contact?: string;
  metadata?: Record<string, unknown>;
}

export interface Principal {
  id: PrincipalId;
  kind: PrincipalKind;
  displayName: string;
  description?: string;
  status: PrincipalStatus;
  identityBindings: IdentityBinding[];
  addressBindings: AddressBinding[];
  operator?: PrincipalOperatorInfo;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CapabilityDescriptor {
  id?: CapabilityId;
  name: string;
  description?: string;
  tags?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
}

export interface AvailabilityDescriptor {
  mode: "always" | "scheduled" | "manual" | "unknown";
  schedule?: string;
  maxConcurrentWorkOrders?: number;
}

export interface CostPreference {
  currency?: string;
  minReward?: string;
  pricingModel?: "free" | "fixed" | "hourly" | "per_task" | "unknown";
}

export interface Agent {
  id: AgentId;
  principalId: PrincipalId;
  displayName: string;
  description?: string;
  status: AgentStatus;
  capabilities: CapabilityDescriptor[];
  availability?: AvailabilityDescriptor;
  costPreference?: CostPreference;
  eligibleRoles: ConcordRole[];
  defaultRuntimeBindingId?: RuntimeBindingId;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RuntimePermissionScope {
  allowedToolRefs?: string[];
  allowedStateSourceRefs?: string[];
  allowedNetwork?: boolean;
  allowedFileSystem?: boolean;
  maxExecutionSeconds?: number;
  notes?: string;
}

export interface RuntimeEndpoint {
  kind: "local_command" | "http" | "websocket" | "manual";
  uri?: string;
  command?: string;
  args?: string[];
}

export interface RuntimeBinding {
  id: RuntimeBindingId;
  agentId: AgentId;
  principalId: PrincipalId;
  runtimeKind: RuntimeKind;
  runtimeAdapterId: string;
  status: RuntimeBindingStatus;
  capabilities: CapabilityDescriptor[];
  permissionScope: RuntimePermissionScope;
  endpoint?: RuntimeEndpoint;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  revokedAt?: Timestamp;
}

export interface ProjectMembership {
  id: MembershipId;
  projectId: ProjectId;
  principalId: PrincipalId;
  agentId?: AgentId;
  status: MembershipStatus;
  roles: ConcordRole[];
  joinedAt: Timestamp;
  updatedAt: Timestamp;
  leftAt?: Timestamp;
  source: "sponsor" | "manual" | "policy" | "governance" | "scenario";
}

export interface ProjectBootstrap {
  id: ProjectBootstrapId;
  projectId: ProjectId;
  initialKnowledgeRefs: ArtifactRef[];
  initialStateRefs?: ArtifactRef[];
  initialPolicyRefs?: ArtifactRef[];
  initialSkillRefs?: ArtifactRef[];
  initialProtocolRefs?: ArtifactRef[];
  createdBy: PrincipalId;
  createdAt: Timestamp;
}

export interface BoundaryEvaluation {
  projectId: ProjectId;
  boundaryId: BoundaryId;
  actionType: string;
  allowed: boolean;
  riskLevel: RiskLevel;
  requiredFlow?: BoundaryEscalationRule["requiredFlow"];
  matchedRules: string[];
  reasons: string[];
}

export type ProjectErrorCode =
  | "PROJECT_NOT_FOUND"
  | "PROJECT_SLUG_ALREADY_EXISTS"
  | "PROJECT_NOT_ACTIVE"
  | "PROJECT_ALREADY_ARCHIVED"
  | "PROJECT_REQUIRES_ACTIVE_OBJECTIVE"
  | "PROJECT_REQUIRES_ACTIVE_BOUNDARY"
  | "OBJECTIVE_NOT_FOUND"
  | "OBJECTIVE_NOT_ACTIVE"
  | "OBJECTIVE_PARENT_PROJECT_MISMATCH"
  | "OBJECTIVE_CYCLE_DETECTED"
  | "BOUNDARY_NOT_FOUND"
  | "BOUNDARY_DENIED_ACTION"
  | "BOUNDARY_REQUIRES_ESCALATION"
  | "PRINCIPAL_NOT_FOUND"
  | "PRINCIPAL_NOT_ACTIVE"
  | "AGENT_NOT_FOUND"
  | "AGENT_NOT_ACTIVE"
  | "AGENT_PRINCIPAL_MISMATCH"
  | "RUNTIME_BINDING_NOT_FOUND"
  | "RUNTIME_BINDING_NOT_ACTIVE"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_NOT_ACTIVE"
  | "ROLE_NOT_ELIGIBLE";

export class ProjectError extends Error {
  constructor(
    readonly code: ProjectErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function assertValidProjectSlug(slug: string): void {
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    throw new ProjectError("PROJECT_NOT_FOUND", `Invalid project slug: ${slug}`);
  }
}

export function assertRequired(value: string | undefined, label: string): void {
  if (!value?.trim()) throw new ProjectError("PROJECT_NOT_FOUND", `${label} is required`);
}

export function validateObjectiveShape(input: Pick<Objective, "title" | "description" | "successCriteria">): void {
  assertRequired(input.title, "Objective title");
  assertRequired(input.description, "Objective description");
  if (!input.successCriteria.some((criterion) => criterion.required)) {
    throw new ProjectError("PROJECT_REQUIRES_ACTIVE_OBJECTIVE", "Objective requires at least one required success criterion");
  }
}

export function validateBoundaryShape(input: Pick<Boundary, "prohibitedActions" | "riskRules" | "escalationRules" | "permissionRules">): void {
  const ids = [
    ...input.prohibitedActions.map((rule) => rule.id),
    ...input.riskRules.map((rule) => rule.id),
    ...input.escalationRules.map((rule) => rule.id),
    ...input.permissionRules.map((rule) => rule.id),
  ];
  if (new Set(ids).size !== ids.length) {
    throw new ProjectError("BOUNDARY_NOT_FOUND", "Boundary rule ids must be unique");
  }
  for (const rule of [...input.prohibitedActions, ...input.riskRules, ...input.escalationRules, ...input.permissionRules]) {
    assertRequired(rule.id, "Boundary rule id");
    assertRequired(rule.actionType, "Boundary rule actionType");
  }
}

export function hashBoundary(boundary: Boundary): Hash {
  const { updatedAt: _updatedAt, ...stableBoundary } = boundary;
  return sha256(stableBoundary);
}
