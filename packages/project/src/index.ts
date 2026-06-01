import { createRequire } from "node:module";
import {
  createEvent,
  makeId,
  nowTimestamp,
  sha256,
  version,
  type ArtifactRef,
  type DecisionRecordId,
  type Hash,
  type Version,
  type Timestamp,
} from "@vibly-ai/concord-foundation";
import type {
  AgentId,
  BoundaryId,
  CapabilityId,
  MembershipId,
  ObjectiveId,
  OrganizationId,
  PrincipalId,
  ProductId,
  ProjectBootstrapId,
  ProjectId,
  RuntimeBindingId,
  AddressBindingId,
} from "@vibly-ai/concord-foundation";
import type { LegacyActionIntent, ActionPolicyRegistry, Actor, ConcordRole, ContextBundle, DecisionFlow, EventStore, PolicyDecision, StateView } from "@vibly-ai/concord-core";

type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): unknown;
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown;
  };
};

const requireModule = createRequire(import.meta.url);

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
export type OrganizationStatus = "draft" | "active" | "paused" | "archived";
export type ProductStatus = "draft" | "active" | "retired" | "archived";
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

export interface Organization {
  id: OrganizationId;
  slug: string;
  name: string;
  mission?: string;
  vision?: string;
  values?: string[];
  status: OrganizationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
}

export interface Product {
  id: ProductId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  slug: string;
  name: string;
  description?: string;
  status: ProductStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrganizationHandbook {
  id: string;
  organizationId: OrganizationId;
  version: Version;
  mission?: string;
  vision?: string;
  values?: string[];
  principles: string[];
  roleSystem?: string;
  stakePrinciples?: string;
  reputationPrinciples?: string;
  rewardPrinciples?: string;
  humanInterventionPrinciples?: string;
  safetyBoundaries?: string[];
  artifact?: ArtifactRef;
  publishedBy: PrincipalId | AgentId;
  publishedAt: Timestamp;
}

export interface ProjectHandbook {
  id: string;
  organizationId: OrganizationId;
  projectId: ProjectId;
  version: Version;
  objective: string;
  phases?: string[];
  roles?: string[];
  scoringRules?: string[];
  taskMechanisms?: string[];
  acceptanceStandards?: string[];
  knowledgeBaseStructure?: string[];
  humanRequestRules?: string[];
  artifact?: ArtifactRef;
  publishedBy: PrincipalId | AgentId;
  publishedAt: Timestamp;
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
  organizationId: OrganizationId;
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

export interface ProjectCreatedPayload {
  project: Project;
}

export interface ProjectUpdatedPayload {
  projectId: ProjectId;
  patch: Partial<Project>;
}

export interface ProjectActivatedPayload {
  projectId: ProjectId;
  activatedBy: PrincipalId | AgentId;
  reason?: string;
}

export interface ProjectPausedPayload {
  projectId: ProjectId;
  pausedBy: PrincipalId | AgentId;
  reason: string;
}

export interface ProjectArchivedPayload {
  projectId: ProjectId;
  archivedBy: PrincipalId | AgentId;
  reason: string;
}

export interface ProjectBootstrappedPayload {
  bootstrap: ProjectBootstrap;
}

export interface ObjectiveCreatedPayload {
  objective: Objective;
}

export interface ObjectiveActivatedPayload {
  objectiveId: ObjectiveId;
  projectId: ProjectId;
  activatedBy: PrincipalId | AgentId;
}

export interface ObjectiveUpdatedPayload {
  objectiveId: ObjectiveId;
  projectId: ProjectId;
  patch: Partial<Objective>;
}

export interface ObjectiveClosedPayload {
  objectiveId: ObjectiveId;
  projectId: ProjectId;
  status: Extract<ObjectiveStatus, "succeeded" | "failed" | "superseded" | "abandoned">;
  reason: string;
}

export interface ProjectPrimaryObjectiveSetPayload {
  projectId: ProjectId;
  objectiveId: ObjectiveId;
  setBy: PrincipalId | AgentId;
}

export interface BoundaryCreatedPayload {
  boundary: Boundary;
}

export interface BoundaryActivatedPayload {
  boundaryId: BoundaryId;
  projectId: ProjectId;
  activatedBy: PrincipalId | AgentId;
}

export interface BoundarySupersededPayload {
  previousBoundaryId: BoundaryId;
  nextBoundaryId: BoundaryId;
  projectId: ProjectId;
  decisionRecordId?: DecisionRecordId;
  reason: string;
}

export interface PrincipalRegisteredPayload {
  principal: Principal;
}

export interface PrincipalStatusChangedPayload {
  principalId: PrincipalId;
  previousStatus: PrincipalStatus;
  nextStatus: PrincipalStatus;
  reason: string;
}

export interface PrincipalAddressBoundPayload {
  principalId: PrincipalId;
  addressBinding: AddressBinding;
}

export interface AgentRegisteredPayload {
  agent: Agent;
}

export interface AgentStatusChangedPayload {
  agentId: AgentId;
  principalId: PrincipalId;
  previousStatus: AgentStatus;
  nextStatus: AgentStatus;
  reason: string;
}

export interface RuntimeBindingCreatedPayload {
  runtimeBinding: RuntimeBinding;
}

export interface RuntimeBindingRevokedPayload {
  runtimeBindingId: RuntimeBindingId;
  agentId: AgentId;
  principalId: PrincipalId;
  reason: string;
}

export interface ProjectMemberAddedPayload {
  membership: ProjectMembership;
}

export interface ProjectMemberStatusChangedPayload {
  membershipId: MembershipId;
  projectId: ProjectId;
  previousStatus: MembershipStatus;
  nextStatus: MembershipStatus;
  reason: string;
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

export interface ListProjectsInput {
  status?: ProjectStatus[];
  sponsorPrincipalId?: PrincipalId;
  limit?: number;
}

export interface ListPrincipalsInput {
  status?: PrincipalStatus[];
  kind?: PrincipalKind[];
  limit?: number;
}

export interface ListAgentsInput {
  status?: AgentStatus[];
  principalId?: PrincipalId;
  eligibleRole?: ConcordRole;
  capabilityTag?: string;
  limit?: number;
}

export interface FindMembershipInput {
  projectId: ProjectId;
  principalId?: PrincipalId;
  agentId?: AgentId;
}

export interface ProjectStore {
  saveProject(project: Project): Promise<void>;
  getProject(projectId: ProjectId): Promise<Project | null>;
  getProjectBySlug(slug: string): Promise<Project | null>;
  listProjects(input?: ListProjectsInput): Promise<Project[]>;
  saveObjective(objective: Objective): Promise<void>;
  getObjective(objectiveId: ObjectiveId): Promise<Objective | null>;
  listObjectives(projectId: ProjectId): Promise<Objective[]>;
  saveBoundary(boundary: Boundary): Promise<void>;
  getBoundary(boundaryId: BoundaryId): Promise<Boundary | null>;
  getActiveBoundary(projectId: ProjectId): Promise<Boundary | null>;
  savePrincipal(principal: Principal): Promise<void>;
  getPrincipal(principalId: PrincipalId): Promise<Principal | null>;
  listPrincipals(input?: ListPrincipalsInput): Promise<Principal[]>;
  saveAgent(agent: Agent): Promise<void>;
  getAgent(agentId: AgentId): Promise<Agent | null>;
  listAgents(input?: ListAgentsInput): Promise<Agent[]>;
  saveRuntimeBinding(binding: RuntimeBinding): Promise<void>;
  getRuntimeBinding(id: RuntimeBindingId): Promise<RuntimeBinding | null>;
  listRuntimeBindings(agentId: AgentId): Promise<RuntimeBinding[]>;
  saveMembership(membership: ProjectMembership): Promise<void>;
  getMembership(id: MembershipId): Promise<ProjectMembership | null>;
  listMemberships(projectId: ProjectId): Promise<ProjectMembership[]>;
  findMembership(input: FindMembershipInput): Promise<ProjectMembership | null>;
}

export interface CreateBoundaryInput {
  projectId?: ProjectId;
  description?: string;
  prohibitedActions?: BoundaryActionRule[];
  riskRules?: BoundaryRiskRule[];
  escalationRules?: BoundaryEscalationRule[];
  permissionRules?: BoundaryPermissionRule[];
  defaultRiskLevel?: RiskLevel;
  createdBy: PrincipalId | AgentId;
}

export interface CreateProjectInput {
  organizationId?: OrganizationId;
  slug: string;
  name: string;
  description?: string;
  sponsorPrincipalId: PrincipalId;
  boundary: CreateBoundaryInput;
  protocol?: Partial<ProjectProtocolConfig>;
  governance?: ProjectGovernanceConfig;
  incentive?: ProjectIncentiveConfig;
  metadata?: Record<string, unknown>;
}

export interface ActivateProjectInput {
  projectId: ProjectId;
  actorId: PrincipalId | AgentId;
  reason?: string;
}

export interface PauseProjectInput {
  projectId: ProjectId;
  actorId: PrincipalId | AgentId;
  reason: string;
}

export interface ArchiveProjectInput {
  projectId: ProjectId;
  actorId: PrincipalId | AgentId;
  reason: string;
}

export interface BootstrapProjectInput {
  projectId: ProjectId;
  actorId: PrincipalId;
  initialKnowledgeRefs: ArtifactRef[];
  initialStateRefs?: ArtifactRef[];
  initialPolicyRefs?: ArtifactRef[];
  initialSkillRefs?: ArtifactRef[];
  initialProtocolRefs?: ArtifactRef[];
}

export interface CreateObjectiveInput {
  projectId: ProjectId;
  parentObjectiveId?: ObjectiveId;
  title: string;
  description: string;
  kind: ObjectiveKind;
  timebox?: ObjectiveTimebox;
  successCriteria: AcceptanceCriterion[];
  forbiddenOutcomes?: string[];
  priority?: number;
  createdBy: PrincipalId | AgentId;
}

export interface ActivateObjectiveInput {
  objectiveId: ObjectiveId;
  actorId: PrincipalId | AgentId;
}

export interface SetPrimaryObjectiveInput {
  projectId: ProjectId;
  objectiveId: ObjectiveId;
  actorId: PrincipalId | AgentId;
}

export interface UpdateObjectiveInput {
  objectiveId: ObjectiveId;
  actorId: PrincipalId | AgentId;
  patch: Partial<Pick<Objective, "title" | "description" | "timebox" | "successCriteria" | "forbiddenOutcomes" | "priority">>;
}

export interface CloseObjectiveInput {
  objectiveId: ObjectiveId;
  actorId: PrincipalId | AgentId;
  status: Extract<ObjectiveStatus, "succeeded" | "failed" | "superseded" | "abandoned">;
  reason: string;
}

export interface ActivateBoundaryInput {
  boundaryId: BoundaryId;
  actorId: PrincipalId | AgentId;
}

export interface ReviseBoundaryInput {
  projectId: ProjectId;
  previousBoundaryId: BoundaryId;
  actorId: PrincipalId | AgentId;
  nextBoundary: Omit<CreateBoundaryInput, "projectId" | "createdBy">;
  decisionRecordId?: DecisionRecordId;
  reason: string;
}

export interface EvaluateBoundaryActionInput {
  projectId: ProjectId;
  actionType: string;
  actor?: PrincipalId | AgentId;
  roles?: ConcordRole[];
  metadata?: Record<string, unknown>;
}

export interface RegisterPrincipalInput {
  kind: PrincipalKind;
  displayName: string;
  description?: string;
  identityBindings?: IdentityBinding[];
  addressBindings?: AddressBinding[];
  operator?: PrincipalOperatorInfo;
}

export interface BindAddressInput {
  principalId: PrincipalId;
  chain: string;
  address: string;
  publicKey?: string;
  proof?: ArtifactRef;
  status?: "pending" | "verified";
}

export interface ChangePrincipalStatusInput {
  principalId: PrincipalId;
  nextStatus: PrincipalStatus;
  reason: string;
}

export interface RegisterAgentInput {
  principalId: PrincipalId;
  displayName: string;
  description?: string;
  capabilities?: CapabilityDescriptor[];
  availability?: AvailabilityDescriptor;
  costPreference?: CostPreference;
  eligibleRoles?: ConcordRole[];
  metadata?: Record<string, unknown>;
}

export interface ChangeAgentStatusInput {
  agentId: AgentId;
  nextStatus: AgentStatus;
  reason: string;
}

export interface CreateRuntimeBindingInput {
  agentId: AgentId;
  runtimeKind: RuntimeKind;
  runtimeAdapterId: string;
  capabilities?: CapabilityDescriptor[];
  permissionScope?: RuntimePermissionScope;
  endpoint?: RuntimeEndpoint;
}

export interface RevokeRuntimeBindingInput {
  runtimeBindingId: RuntimeBindingId;
  reason: string;
}

export interface AddProjectMemberInput {
  projectId: ProjectId;
  principalId: PrincipalId;
  agentId?: AgentId;
  roles: ConcordRole[];
  source: "sponsor" | "manual" | "policy" | "governance" | "scenario";
}

export interface ChangeMembershipStatusInput {
  membershipId: MembershipId;
  nextStatus: MembershipStatus;
  reason: string;
}

export class PrincipalService {
  constructor(
    private readonly store: ProjectStore,
    private readonly eventStore?: EventStore,
  ) {}

  async registerPrincipal(input: RegisterPrincipalInput): Promise<Principal> {
    assertRequired(input.displayName, "Principal displayName");
    if (!input.identityBindings?.length && !input.addressBindings?.length && input.kind !== "unknown" && input.kind !== "service") {
      throw new ProjectError("PRINCIPAL_NOT_ACTIVE", "Principal requires identity/address binding unless kind is unknown or service");
    }
    const now = nowTimestamp();
    const principal: Principal = {
      id: makeId("PrincipalId"),
      kind: input.kind,
      displayName: input.displayName,
      status: "active",
      identityBindings: input.identityBindings ?? [],
      addressBindings: input.addressBindings ?? [],
      createdAt: now,
      updatedAt: now,
      ...(input.description ? { description: input.description } : {}),
      ...(input.operator ? { operator: input.operator } : {}),
    };
    await this.store.savePrincipal(principal);
    await this.eventStore?.append(createEvent({ type: "PrincipalRegistered", payload: { principal } satisfies PrincipalRegisteredPayload }));
    return principal;
  }

  async bindAddress(input: BindAddressInput): Promise<AddressBinding> {
    const principal = await requirePrincipal(this.store, input.principalId);
    const now = nowTimestamp();
    const addressBinding: AddressBinding = {
      id: makeId("AddressBindingId"),
      chain: input.chain,
      address: input.address,
      status: input.status ?? "pending",
      createdAt: now,
      ...(input.publicKey ? { publicKey: input.publicKey } : {}),
      ...(input.proof ? { proof: input.proof } : {}),
      ...(input.status === "verified" ? { verifiedAt: now } : {}),
    };
    const updated = { ...principal, addressBindings: [...principal.addressBindings, addressBinding], updatedAt: now };
    await this.store.savePrincipal(updated);
    await this.eventStore?.append(
      createEvent({ type: "PrincipalAddressBound", payload: { principalId: principal.id, addressBinding } satisfies PrincipalAddressBoundPayload }),
    );
    return addressBinding;
  }

  async changePrincipalStatus(input: ChangePrincipalStatusInput): Promise<Principal> {
    const principal = await requirePrincipal(this.store, input.principalId);
    const updated = { ...principal, status: input.nextStatus, updatedAt: nowTimestamp() };
    await this.store.savePrincipal(updated);
    await this.eventStore?.append(
      createEvent({
        type: "PrincipalStatusChanged",
        payload: { principalId: principal.id, previousStatus: principal.status, nextStatus: input.nextStatus, reason: input.reason } satisfies PrincipalStatusChangedPayload,
      }),
    );
    return updated;
  }

  getPrincipal(principalId: PrincipalId): Promise<Principal | null> {
    return this.store.getPrincipal(principalId);
  }

  listPrincipals(input?: ListPrincipalsInput): Promise<Principal[]> {
    return this.store.listPrincipals(input);
  }
}

export class AgentService {
  constructor(
    private readonly store: ProjectStore,
    private readonly eventStore?: EventStore,
  ) {}

  async registerAgent(input: RegisterAgentInput): Promise<Agent> {
    const principal = await requirePrincipal(this.store, input.principalId);
    if (principal.status !== "active") throw new ProjectError("PRINCIPAL_NOT_ACTIVE", `Principal is not active: ${principal.id}`);
    assertRequired(input.displayName, "Agent displayName");
    for (const capability of input.capabilities ?? []) assertRequired(capability.name, "Capability name");
    const now = nowTimestamp();
    const agent: Agent = {
      id: makeId("AgentId"),
      principalId: input.principalId,
      displayName: input.displayName,
      status: "active",
      capabilities: input.capabilities ?? [],
      eligibleRoles: input.eligibleRoles ?? [],
      createdAt: now,
      updatedAt: now,
      ...(input.description ? { description: input.description } : {}),
      ...(input.availability ? { availability: input.availability } : {}),
      ...(input.costPreference ? { costPreference: input.costPreference } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };
    await this.store.saveAgent(agent);
    await this.eventStore?.append(createEvent({ type: "AgentRegistered", payload: { agent } satisfies AgentRegisteredPayload }));
    return agent;
  }

  async changeAgentStatus(input: ChangeAgentStatusInput): Promise<Agent> {
    const agent = await requireAgent(this.store, input.agentId);
    const updated = { ...agent, status: input.nextStatus, updatedAt: nowTimestamp() };
    await this.store.saveAgent(updated);
    await this.eventStore?.append(
      createEvent({
        type: "AgentStatusChanged",
        payload: { agentId: agent.id, principalId: agent.principalId, previousStatus: agent.status, nextStatus: input.nextStatus, reason: input.reason } satisfies AgentStatusChangedPayload,
      }),
    );
    return updated;
  }

  async createRuntimeBinding(input: CreateRuntimeBindingInput): Promise<RuntimeBinding> {
    const agent = await requireAgent(this.store, input.agentId);
    if (agent.status !== "active") throw new ProjectError("AGENT_NOT_ACTIVE", `Agent is not active: ${agent.id}`);
    assertRequired(input.runtimeAdapterId, "Runtime adapter id");
    const now = nowTimestamp();
    const runtimeBinding: RuntimeBinding = {
      id: makeId("RuntimeBindingId"),
      agentId: agent.id,
      principalId: agent.principalId,
      runtimeKind: input.runtimeKind,
      runtimeAdapterId: input.runtimeAdapterId,
      status: "active",
      capabilities: input.capabilities ?? [],
      permissionScope: input.permissionScope ?? { allowedNetwork: false, allowedFileSystem: false },
      createdAt: now,
      updatedAt: now,
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    };
    await this.store.saveRuntimeBinding(runtimeBinding);
    await this.store.saveAgent({ ...agent, defaultRuntimeBindingId: agent.defaultRuntimeBindingId ?? runtimeBinding.id, updatedAt: now });
    await this.eventStore?.append(
      createEvent({ type: "RuntimeBindingCreated", payload: { runtimeBinding } satisfies RuntimeBindingCreatedPayload }),
    );
    return runtimeBinding;
  }

  async revokeRuntimeBinding(input: RevokeRuntimeBindingInput): Promise<RuntimeBinding> {
    const binding = await requireRuntimeBinding(this.store, input.runtimeBindingId);
    const updated = { ...binding, status: "revoked" as const, revokedAt: nowTimestamp(), updatedAt: nowTimestamp() };
    await this.store.saveRuntimeBinding(updated);
    await this.eventStore?.append(
      createEvent({
        type: "RuntimeBindingRevoked",
        payload: { runtimeBindingId: binding.id, agentId: binding.agentId, principalId: binding.principalId, reason: input.reason } satisfies RuntimeBindingRevokedPayload,
      }),
    );
    return updated;
  }

  async addProjectMember(input: AddProjectMemberInput): Promise<ProjectMembership> {
    await requireProject(this.store, input.projectId);
    const principal = await requirePrincipal(this.store, input.principalId);
    if (principal.status !== "active") throw new ProjectError("PRINCIPAL_NOT_ACTIVE", `Principal is not active: ${principal.id}`);
    const agent = input.agentId ? await requireAgent(this.store, input.agentId) : null;
    if (agent && agent.principalId !== input.principalId) {
      throw new ProjectError("AGENT_PRINCIPAL_MISMATCH", "Membership agent must belong to the membership principal");
    }
    if (agent && !["sponsor", "manual"].includes(input.source)) {
      const ineligible = input.roles.find((role) => !agent.eligibleRoles.includes(role));
      if (ineligible) throw new ProjectError("ROLE_NOT_ELIGIBLE", `Agent is not eligible for role ${ineligible}`);
    }
    const now = nowTimestamp();
    const membership: ProjectMembership = {
      id: makeId("MembershipId"),
      projectId: input.projectId,
      principalId: input.principalId,
      status: "active",
      roles: input.roles,
      joinedAt: now,
      updatedAt: now,
      source: input.source,
      ...(input.agentId ? { agentId: input.agentId } : {}),
    };
    await this.store.saveMembership(membership);
    await this.eventStore?.append(createEvent({ type: "ProjectMemberAdded", payload: { membership } satisfies ProjectMemberAddedPayload }));
    return membership;
  }

  async changeMembershipStatus(input: ChangeMembershipStatusInput): Promise<ProjectMembership> {
    const membership = await requireMembership(this.store, input.membershipId);
    const updated = {
      ...membership,
      status: input.nextStatus,
      updatedAt: nowTimestamp(),
      ...(["left", "removed"].includes(input.nextStatus) ? { leftAt: nowTimestamp() } : {}),
    };
    await this.store.saveMembership(updated);
    await this.eventStore?.append(
      createEvent({
        type: "ProjectMemberStatusChanged",
        payload: {
          membershipId: membership.id,
          projectId: membership.projectId,
          previousStatus: membership.status,
          nextStatus: input.nextStatus,
          reason: input.reason,
        } satisfies ProjectMemberStatusChangedPayload,
      }),
    );
    return updated;
  }

  getAgent(agentId: AgentId): Promise<Agent | null> {
    return this.store.getAgent(agentId);
  }

  listAgents(input?: ListAgentsInput): Promise<Agent[]> {
    return this.store.listAgents(input);
  }

  listProjectMembers(projectId: ProjectId): Promise<ProjectMembership[]> {
    return this.store.listMemberships(projectId);
  }
}

export class ProjectService {
  constructor(
    private readonly store: ProjectStore,
    private readonly eventStore?: EventStore,
  ) {}

  async createProject(input: CreateProjectInput): Promise<Project> {
    assertValidProjectSlug(input.slug);
    assertRequired(input.name, "Project name");
    await requirePrincipal(this.store, input.sponsorPrincipalId);
    if (await this.store.getProjectBySlug(input.slug)) {
      throw new ProjectError("PROJECT_SLUG_ALREADY_EXISTS", `Project slug already exists: ${input.slug}`);
    }
    const now = nowTimestamp();
    const projectId = makeId("ProjectId");
    const boundary = createBoundaryRecord({ ...input.boundary, projectId, createdBy: input.boundary.createdBy ?? input.sponsorPrincipalId }, "active");
    const project: Project = {
      id: projectId,
      organizationId: input.organizationId ?? makeId("OrganizationId", "organization_default"),
      slug: input.slug,
      name: input.name,
      status: "draft",
      sponsorPrincipalId: input.sponsorPrincipalId,
      boundaryId: boundary.id,
      protocol: { version: input.protocol?.version ?? version("1.0.0"), traceRequired: input.protocol?.traceRequired ?? true },
      createdAt: now,
      updatedAt: now,
      ...(input.description ? { description: input.description } : {}),
      ...(input.governance ? { governance: input.governance } : {}),
      ...(input.incentive ? { incentive: input.incentive } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };
    await this.store.saveBoundary(boundary);
    await this.store.saveProject(project);
    await this.eventStore?.append(createEvent({ type: "BoundaryCreated", payload: { boundary } satisfies BoundaryCreatedPayload }));
    await this.eventStore?.append(createEvent({ type: "ProjectCreated", correlationId: project.id, payload: { project } satisfies ProjectCreatedPayload }));
    return project;
  }

  async activateProject(input: ActivateProjectInput): Promise<Project> {
    const project = await requireProject(this.store, input.projectId);
    if (project.status === "archived") throw new ProjectError("PROJECT_ALREADY_ARCHIVED", `Project is archived: ${project.id}`);
    const objective = project.primaryObjectiveId ? await this.store.getObjective(project.primaryObjectiveId) : null;
    if (!objective || objective.status !== "active") throw new ProjectError("PROJECT_REQUIRES_ACTIVE_OBJECTIVE", "Project activation requires active primary objective");
    const boundary = await this.store.getActiveBoundary(project.id);
    if (!boundary) throw new ProjectError("PROJECT_REQUIRES_ACTIVE_BOUNDARY", "Project activation requires active boundary");
    const updated = { ...project, status: "active" as const, updatedAt: nowTimestamp(), boundaryId: boundary.id };
    await this.store.saveProject(updated);
    await this.eventStore?.append(
      createEvent({
        type: "ProjectActivated",
        correlationId: project.id,
        payload: { projectId: project.id, activatedBy: input.actorId, ...(input.reason ? { reason: input.reason } : {}) } satisfies ProjectActivatedPayload,
      }),
    );
    return updated;
  }

  async pauseProject(input: PauseProjectInput): Promise<Project> {
    const project = await requireProject(this.store, input.projectId);
    const updated = { ...project, status: "paused" as const, updatedAt: nowTimestamp() };
    await this.store.saveProject(updated);
    await this.eventStore?.append(
      createEvent({ type: "ProjectPaused", correlationId: project.id, payload: { projectId: project.id, pausedBy: input.actorId, reason: input.reason } satisfies ProjectPausedPayload }),
    );
    return updated;
  }

  async archiveProject(input: ArchiveProjectInput): Promise<Project> {
    const project = await requireProject(this.store, input.projectId);
    const now = nowTimestamp();
    const updated = { ...project, status: "archived" as const, updatedAt: now, archivedAt: now };
    await this.store.saveProject(updated);
    await this.eventStore?.append(
      createEvent({ type: "ProjectArchived", correlationId: project.id, payload: { projectId: project.id, archivedBy: input.actorId, reason: input.reason } satisfies ProjectArchivedPayload }),
    );
    return updated;
  }

  async bootstrapProject(input: BootstrapProjectInput): Promise<ProjectBootstrap> {
    const project = await requireProject(this.store, input.projectId);
    const bootstrap: ProjectBootstrap = {
      id: makeId("ProjectBootstrapId"),
      projectId: project.id,
      initialKnowledgeRefs: input.initialKnowledgeRefs,
      createdBy: input.actorId,
      createdAt: nowTimestamp(),
      ...(input.initialStateRefs ? { initialStateRefs: input.initialStateRefs } : {}),
      ...(input.initialPolicyRefs ? { initialPolicyRefs: input.initialPolicyRefs } : {}),
      ...(input.initialSkillRefs ? { initialSkillRefs: input.initialSkillRefs } : {}),
      ...(input.initialProtocolRefs ? { initialProtocolRefs: input.initialProtocolRefs } : {}),
    };
    await this.store.saveProject({ ...project, bootstrapId: bootstrap.id, updatedAt: nowTimestamp() });
    await this.eventStore?.append(createEvent({ type: "ProjectBootstrapped", correlationId: project.id, payload: { bootstrap } satisfies ProjectBootstrappedPayload }));
    return bootstrap;
  }

  getProject(projectId: ProjectId): Promise<Project | null> {
    return this.store.getProject(projectId);
  }

  getProjectBySlug(slug: string): Promise<Project | null> {
    return this.store.getProjectBySlug(slug);
  }

  listProjects(input?: ListProjectsInput): Promise<Project[]> {
    return this.store.listProjects(input);
  }
}

export class ObjectiveService {
  constructor(
    private readonly store: ProjectStore,
    private readonly eventStore?: EventStore,
  ) {}

  async createObjective(input: CreateObjectiveInput): Promise<Objective> {
    await requireProject(this.store, input.projectId);
    validateObjectiveShape(input);
    if (input.parentObjectiveId) {
      const parent = await requireObjective(this.store, input.parentObjectiveId);
      if (parent.projectId !== input.projectId) throw new ProjectError("OBJECTIVE_PARENT_PROJECT_MISMATCH", "Parent objective must belong to the same project");
    }
    const now = nowTimestamp();
    const objective: Objective = {
      id: makeId("ObjectiveId"),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      kind: input.kind,
      status: "draft",
      successCriteria: input.successCriteria,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      ...(input.parentObjectiveId ? { parentObjectiveId: input.parentObjectiveId } : {}),
      ...(input.timebox ? { timebox: input.timebox } : {}),
      ...(input.forbiddenOutcomes ? { forbiddenOutcomes: input.forbiddenOutcomes } : {}),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
    };
    await assertNoObjectiveCycle(this.store, objective);
    await this.store.saveObjective(objective);
    await this.eventStore?.append(createEvent({ type: "ObjectiveCreated", correlationId: input.projectId, payload: { objective } satisfies ObjectiveCreatedPayload }));
    return objective;
  }

  async activateObjective(input: ActivateObjectiveInput): Promise<Objective> {
    const objective = await requireObjective(this.store, input.objectiveId);
    if (["succeeded", "failed", "superseded", "abandoned"].includes(objective.status)) {
      throw new ProjectError("OBJECTIVE_NOT_ACTIVE", `Closed objective cannot be activated: ${objective.id}`);
    }
    const updated = { ...objective, status: "active" as const, updatedAt: nowTimestamp() };
    await this.store.saveObjective(updated);
    await this.eventStore?.append(
      createEvent({ type: "ObjectiveActivated", correlationId: objective.projectId, payload: { objectiveId: objective.id, projectId: objective.projectId, activatedBy: input.actorId } satisfies ObjectiveActivatedPayload }),
    );
    return updated;
  }

  async setPrimaryObjective(input: SetPrimaryObjectiveInput): Promise<Project> {
    const project = await requireProject(this.store, input.projectId);
    const objective = await requireObjective(this.store, input.objectiveId);
    if (objective.projectId !== project.id) throw new ProjectError("OBJECTIVE_PARENT_PROJECT_MISMATCH", "Primary objective must belong to project");
    if (objective.status !== "active") throw new ProjectError("OBJECTIVE_NOT_ACTIVE", "Primary objective must be active");
    const updated = { ...project, primaryObjectiveId: objective.id, updatedAt: nowTimestamp() };
    await this.store.saveProject(updated);
    await this.eventStore?.append(
      createEvent({ type: "ProjectPrimaryObjectiveSet", correlationId: project.id, payload: { projectId: project.id, objectiveId: objective.id, setBy: input.actorId } satisfies ProjectPrimaryObjectiveSetPayload }),
    );
    return updated;
  }

  async updateObjective(input: UpdateObjectiveInput): Promise<Objective> {
    const objective = await requireObjective(this.store, input.objectiveId);
    const updated = { ...objective, ...input.patch, updatedAt: nowTimestamp() };
    validateObjectiveShape(updated);
    await this.store.saveObjective(updated);
    await this.eventStore?.append(
      createEvent({ type: "ObjectiveUpdated", correlationId: objective.projectId, payload: { objectiveId: objective.id, projectId: objective.projectId, patch: input.patch } satisfies ObjectiveUpdatedPayload }),
    );
    return updated;
  }

  async closeObjective(input: CloseObjectiveInput): Promise<Objective> {
    const objective = await requireObjective(this.store, input.objectiveId);
    const updated = { ...objective, status: input.status, updatedAt: nowTimestamp(), closedAt: nowTimestamp() };
    await this.store.saveObjective(updated);
    await this.eventStore?.append(
      createEvent({ type: "ObjectiveClosed", correlationId: objective.projectId, payload: { objectiveId: objective.id, projectId: objective.projectId, status: input.status, reason: input.reason } satisfies ObjectiveClosedPayload }),
    );
    return updated;
  }

  getObjective(objectiveId: ObjectiveId): Promise<Objective | null> {
    return this.store.getObjective(objectiveId);
  }

  listObjectives(projectId: ProjectId): Promise<Objective[]> {
    return this.store.listObjectives(projectId);
  }
}

export class BoundaryService {
  constructor(
    private readonly store: ProjectStore,
    private readonly eventStore?: EventStore,
  ) {}

  async createBoundary(input: CreateBoundaryInput): Promise<Boundary> {
    const boundary = createBoundaryRecord(input, "draft");
    if (input.projectId) await requireProject(this.store, input.projectId);
    await this.store.saveBoundary(boundary);
    await this.eventStore?.append(createEvent({ type: "BoundaryCreated", correlationId: boundary.projectId, payload: { boundary } satisfies BoundaryCreatedPayload }));
    return boundary;
  }

  async activateBoundary(input: ActivateBoundaryInput): Promise<Boundary> {
    const boundary = await requireBoundary(this.store, input.boundaryId);
    const updated = { ...boundary, status: "active" as const, updatedAt: nowTimestamp() };
    await this.store.saveBoundary(updated);
    await this.eventStore?.append(
      createEvent({ type: "BoundaryActivated", correlationId: boundary.projectId, payload: { boundaryId: boundary.id, projectId: boundary.projectId, activatedBy: input.actorId } satisfies BoundaryActivatedPayload }),
    );
    return updated;
  }

  async reviseBoundary(input: ReviseBoundaryInput): Promise<Boundary> {
    const project = await requireProject(this.store, input.projectId);
    const previous = await requireBoundary(this.store, input.previousBoundaryId);
    if (previous.projectId !== project.id) throw new ProjectError("BOUNDARY_NOT_FOUND", "Previous boundary does not belong to project");
    const next = createBoundaryRecord({ ...input.nextBoundary, projectId: project.id, createdBy: input.actorId }, "active");
    const superseded = { ...previous, status: "superseded" as const, supersededBy: next.id, updatedAt: nowTimestamp() };
    await this.store.saveBoundary(superseded);
    await this.store.saveBoundary(next);
    await this.store.saveProject({ ...project, boundaryId: next.id, updatedAt: nowTimestamp() });
    await this.eventStore?.append(
      createEvent({
        type: "BoundarySuperseded",
        correlationId: project.id,
        payload: {
          previousBoundaryId: previous.id,
          nextBoundaryId: next.id,
          projectId: project.id,
          ...(input.decisionRecordId ? { decisionRecordId: input.decisionRecordId } : {}),
          reason: input.reason,
        } satisfies BoundarySupersededPayload,
      }),
    );
    return next;
  }

  async evaluateAction(input: EvaluateBoundaryActionInput): Promise<BoundaryEvaluation> {
    const boundary = await this.store.getActiveBoundary(input.projectId);
    if (!boundary) throw new ProjectError("PROJECT_REQUIRES_ACTIVE_BOUNDARY", `No active boundary for project ${input.projectId}`);
    const matchedRules: string[] = [];
    const reasons: string[] = [];
    let allowed = true;
    let riskLevel = boundary.defaultRiskLevel;
    let requiredFlow: BoundaryEvaluation["requiredFlow"];

    for (const rule of boundary.prohibitedActions.filter((rule) => rule.actionType === input.actionType)) {
      matchedRules.push(rule.id);
      reasons.push(rule.reason);
      if (rule.effect === "deny") allowed = false;
    }
    for (const rule of boundary.permissionRules.filter((rule) => rule.actionType === input.actionType && subjectMatches(rule, input))) {
      matchedRules.push(rule.id);
      reasons.push(rule.reason);
      if (rule.effect === "deny") allowed = false;
      if (rule.effect === "allow" && allowed) allowed = true;
    }
    for (const rule of boundary.riskRules.filter((rule) => rule.actionType === input.actionType)) {
      matchedRules.push(rule.id);
      reasons.push(rule.reason);
      riskLevel = maxRisk(riskLevel, rule.riskLevel);
    }
    for (const rule of boundary.escalationRules.filter((rule) => rule.actionType === input.actionType)) {
      matchedRules.push(rule.id);
      reasons.push(rule.reason);
      requiredFlow = maxFlow(requiredFlow, rule.requiredFlow);
    }

    return { projectId: input.projectId, boundaryId: boundary.id, actionType: input.actionType, allowed, riskLevel, ...(requiredFlow ? { requiredFlow } : {}), matchedRules, reasons };
  }

  getBoundary(boundaryId: BoundaryId): Promise<Boundary | null> {
    return this.store.getBoundary(boundaryId);
  }

  getActiveBoundary(projectId: ProjectId): Promise<Boundary | null> {
    return this.store.getActiveBoundary(projectId);
  }
}

export class BoundaryAwareActionPolicyRegistry implements ActionPolicyRegistry {
  constructor(
    private readonly base: ActionPolicyRegistry,
    private readonly store: ProjectStore,
    private readonly boundaries: BoundaryService,
    private readonly eventStore?: EventStore,
  ) {}

  getPolicy(actionType: string) {
    return this.base.getPolicy(actionType);
  }

  registerPolicy(input: Parameters<ActionPolicyRegistry["registerPolicy"]>[0]): Promise<void> {
    return this.base.registerPolicy(input);
  }

  async evaluate(input: { action: LegacyActionIntent; actor: Actor; context: ContextBundle }): Promise<PolicyDecision> {
    if (!input.context.projectId && !input.action.projectId) {
      return this.base.evaluate(input);
    }
    const projectId = input.context.projectId ?? input.action.projectId!;
    const project = await this.store.getProject(projectId);
    if (!project || project.status !== "active") {
      return this.recordBoundaryDecision(input, "rejected", "Project is not active");
    }
    const objectiveId = input.context.objectiveId ?? input.action.objectiveId ?? project.primaryObjectiveId;
    if (objectiveId) {
      const objective = await this.store.getObjective(objectiveId);
      if (!objective || objective.projectId !== project.id || objective.status !== "active") {
        return this.recordBoundaryDecision(input, "rejected", "Objective is not active");
      }
    }
    const agent = await this.store.getAgent(input.actor.id as never);
    if (agent) {
      const principal = await this.store.getPrincipal(agent.principalId);
      if (agent.status !== "active" || principal?.status !== "active") {
        return this.recordBoundaryDecision(input, "rejected", "Actor principal or agent is not active");
      }
      const membership = await this.store.findMembership({ projectId: project.id, agentId: agent.id });
      if (!membership || membership.status !== "active") {
        return this.recordBoundaryDecision(input, "rejected", "Actor is not an active project member");
      }
    }
    const boundaryDecision = await this.boundaries.evaluateAction({
      projectId: project.id,
      actionType: input.action.type,
      ...((agent?.id ?? input.context.permissionScope?.principalId) ? { actor: (agent?.id ?? input.context.permissionScope?.principalId)! } : {}),
      ...(input.context.permissionScope?.roles ? { roles: input.context.permissionScope.roles } : {}),
    });
    if (!boundaryDecision.allowed) {
      return this.recordBoundaryDecision(input, "rejected", boundaryDecision.reasons.join("; ") || "Boundary denied action");
    }
    const baseDecision = await this.base.evaluate(input);
    return mergePolicyWithBoundary(baseDecision, boundaryDecision);
  }

  private async recordBoundaryDecision(
    input: { action: LegacyActionIntent; actor: Actor },
    result: PolicyDecision["result"],
    reason: string,
  ): Promise<PolicyDecision> {
    const decision: PolicyDecision = {
      id: makeId("PolicyDecisionId"),
      actionId: input.action.id,
      result,
      reason,
      createdAt: nowTimestamp(),
    };
    await this.eventStore?.append(
      createEvent({
        type: "ActionPolicyEvaluated",
        actorId: input.actor.id,
        correlationId: input.action.id,
        payload: { action: input.action, decision, boundary: true },
      }),
    );
    return decision;
  }
}

export class MemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<ProjectId, Project>();
  private readonly objectives = new Map<ObjectiveId, Objective>();
  private readonly boundaries = new Map<BoundaryId, Boundary>();
  private readonly principals = new Map<PrincipalId, Principal>();
  private readonly agents = new Map<AgentId, Agent>();
  private readonly runtimeBindings = new Map<RuntimeBindingId, RuntimeBinding>();
  private readonly memberships = new Map<MembershipId, ProjectMembership>();

  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }

  async getProject(projectId: ProjectId): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    return [...this.projects.values()].find((project) => project.slug === slug) ?? null;
  }

  async listProjects(input: ListProjectsInput = {}): Promise<Project[]> {
    return limit(
      [...this.projects.values()].filter(
        (project) =>
          (!input.status?.length || input.status.includes(project.status)) &&
          (!input.sponsorPrincipalId || input.sponsorPrincipalId === project.sponsorPrincipalId),
      ),
      input.limit,
    );
  }

  async saveObjective(objective: Objective): Promise<void> {
    this.objectives.set(objective.id, objective);
  }

  async getObjective(objectiveId: ObjectiveId): Promise<Objective | null> {
    return this.objectives.get(objectiveId) ?? null;
  }

  async listObjectives(projectId: ProjectId): Promise<Objective[]> {
    return [...this.objectives.values()].filter((objective) => objective.projectId === projectId);
  }

  async saveBoundary(boundary: Boundary): Promise<void> {
    this.boundaries.set(boundary.id, boundary);
  }

  async getBoundary(boundaryId: BoundaryId): Promise<Boundary | null> {
    return this.boundaries.get(boundaryId) ?? null;
  }

  async getActiveBoundary(projectId: ProjectId): Promise<Boundary | null> {
    return [...this.boundaries.values()].find((boundary) => boundary.projectId === projectId && boundary.status === "active") ?? null;
  }

  async savePrincipal(principal: Principal): Promise<void> {
    this.principals.set(principal.id, principal);
  }

  async getPrincipal(principalId: PrincipalId): Promise<Principal | null> {
    return this.principals.get(principalId) ?? null;
  }

  async listPrincipals(input: ListPrincipalsInput = {}): Promise<Principal[]> {
    return limit(
      [...this.principals.values()].filter(
        (principal) =>
          (!input.status?.length || input.status.includes(principal.status)) &&
          (!input.kind?.length || input.kind.includes(principal.kind)),
      ),
      input.limit,
    );
  }

  async saveAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async getAgent(agentId: AgentId): Promise<Agent | null> {
    return this.agents.get(agentId) ?? null;
  }

  async listAgents(input: ListAgentsInput = {}): Promise<Agent[]> {
    return limit(
      [...this.agents.values()].filter(
        (agent) =>
          (!input.status?.length || input.status.includes(agent.status)) &&
          (!input.principalId || input.principalId === agent.principalId) &&
          (!input.eligibleRole || agent.eligibleRoles.includes(input.eligibleRole)) &&
          (!input.capabilityTag || agent.capabilities.some((capability) => capability.tags?.includes(input.capabilityTag!))),
      ),
      input.limit,
    );
  }

  async saveRuntimeBinding(binding: RuntimeBinding): Promise<void> {
    this.runtimeBindings.set(binding.id, binding);
  }

  async getRuntimeBinding(id: RuntimeBindingId): Promise<RuntimeBinding | null> {
    return this.runtimeBindings.get(id) ?? null;
  }

  async listRuntimeBindings(agentId: AgentId): Promise<RuntimeBinding[]> {
    return [...this.runtimeBindings.values()].filter((binding) => binding.agentId === agentId);
  }

  async saveMembership(membership: ProjectMembership): Promise<void> {
    this.memberships.set(membership.id, membership);
  }

  async getMembership(id: MembershipId): Promise<ProjectMembership | null> {
    return this.memberships.get(id) ?? null;
  }

  async listMemberships(projectId: ProjectId): Promise<ProjectMembership[]> {
    return [...this.memberships.values()].filter((membership) => membership.projectId === projectId);
  }

  async findMembership(input: FindMembershipInput): Promise<ProjectMembership | null> {
    return (
      [...this.memberships.values()].find(
        (membership) =>
          membership.projectId === input.projectId &&
          (!input.principalId || membership.principalId === input.principalId) &&
          (!input.agentId || membership.agentId === input.agentId),
      ) ?? null
    );
  }
}

export class SQLiteProjectStore implements ProjectStore {
  readonly db: DatabaseSync;

  constructor(filename = ":memory:", db?: DatabaseSync) {
    this.db = db ?? new (loadDatabaseSync())(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        sponsor_principal_id TEXT NOT NULL,
        primary_objective_id TEXT,
        boundary_id TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS objectives (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_objective_id TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_objectives_project_id ON objectives(project_id);
      CREATE TABLE IF NOT EXISTS boundaries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_boundaries_project_id ON boundaries(project_id);
      CREATE INDEX IF NOT EXISTS idx_boundaries_project_status ON boundaries(project_id, status);
      CREATE TABLE IF NOT EXISTS principals (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        display_name TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        principal_id TEXT NOT NULL,
        status TEXT NOT NULL,
        display_name TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agents_principal_id ON agents(principal_id);
      CREATE TABLE IF NOT EXISTS runtime_bindings (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        runtime_kind TEXT NOT NULL,
        runtime_adapter_id TEXT NOT NULL,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_runtime_bindings_agent_id ON runtime_bindings(agent_id);
      CREATE TABLE IF NOT EXISTS project_memberships (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        agent_id TEXT,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memberships_project_id ON project_memberships(project_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_agent_id ON project_memberships(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_principal_id ON project_memberships(principal_id);
    `);
  }

  async saveProject(project: Project): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO projects (id, slug, name, status, sponsor_principal_id, primary_objective_id, boundary_id, json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.slug,
        project.name,
        project.status,
        project.sponsorPrincipalId,
        project.primaryObjectiveId ?? null,
        project.boundaryId,
        JSON.stringify(project),
        project.createdAt.iso,
        project.updatedAt.iso,
      );
  }

  async getProject(projectId: ProjectId): Promise<Project | null> {
    return this.getJson<Project>("SELECT json FROM projects WHERE id = ?", projectId);
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    return this.getJson<Project>("SELECT json FROM projects WHERE slug = ?", slug);
  }

  async listProjects(input: ListProjectsInput = {}): Promise<Project[]> {
    return limit(this.allJson<Project>("SELECT json FROM projects ORDER BY rowid ASC"), input.limit).filter(
      (project) =>
        (!input.status?.length || input.status.includes(project.status)) &&
        (!input.sponsorPrincipalId || project.sponsorPrincipalId === input.sponsorPrincipalId),
    );
  }

  async saveObjective(objective: Objective): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO objectives (id, project_id, parent_objective_id, kind, status, title, json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        objective.id,
        objective.projectId,
        objective.parentObjectiveId ?? null,
        objective.kind,
        objective.status,
        objective.title,
        JSON.stringify(objective),
        objective.createdAt.iso,
        objective.updatedAt.iso,
      );
  }

  async getObjective(objectiveId: ObjectiveId): Promise<Objective | null> {
    return this.getJson<Objective>("SELECT json FROM objectives WHERE id = ?", objectiveId);
  }

  async listObjectives(projectId: ProjectId): Promise<Objective[]> {
    return this.allJson<Objective>("SELECT json FROM objectives WHERE project_id = ? ORDER BY rowid ASC", projectId);
  }

  async saveBoundary(boundary: Boundary): Promise<void> {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO boundaries (id, project_id, version, status, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(boundary.id, boundary.projectId, boundary.version.value, boundary.status, JSON.stringify(boundary), boundary.createdAt.iso, boundary.updatedAt.iso);
  }

  async getBoundary(boundaryId: BoundaryId): Promise<Boundary | null> {
    return this.getJson<Boundary>("SELECT json FROM boundaries WHERE id = ?", boundaryId);
  }

  async getActiveBoundary(projectId: ProjectId): Promise<Boundary | null> {
    return this.getJson<Boundary>("SELECT json FROM boundaries WHERE project_id = ? AND status = 'active' ORDER BY rowid DESC LIMIT 1", projectId);
  }

  async savePrincipal(principal: Principal): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO principals (id, kind, status, display_name, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(principal.id, principal.kind, principal.status, principal.displayName, JSON.stringify(principal), principal.createdAt.iso, principal.updatedAt.iso);
  }

  async getPrincipal(principalId: PrincipalId): Promise<Principal | null> {
    return this.getJson<Principal>("SELECT json FROM principals WHERE id = ?", principalId);
  }

  async listPrincipals(input: ListPrincipalsInput = {}): Promise<Principal[]> {
    return limit(this.allJson<Principal>("SELECT json FROM principals ORDER BY rowid ASC"), input.limit).filter(
      (principal) =>
        (!input.status?.length || input.status.includes(principal.status)) &&
        (!input.kind?.length || input.kind.includes(principal.kind)),
    );
  }

  async saveAgent(agent: Agent): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO agents (id, principal_id, status, display_name, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(agent.id, agent.principalId, agent.status, agent.displayName, JSON.stringify(agent), agent.createdAt.iso, agent.updatedAt.iso);
  }

  async getAgent(agentId: AgentId): Promise<Agent | null> {
    return this.getJson<Agent>("SELECT json FROM agents WHERE id = ?", agentId);
  }

  async listAgents(input: ListAgentsInput = {}): Promise<Agent[]> {
    return limit(this.allJson<Agent>("SELECT json FROM agents ORDER BY rowid ASC"), input.limit).filter(
      (agent) =>
        (!input.status?.length || input.status.includes(agent.status)) &&
        (!input.principalId || agent.principalId === input.principalId) &&
        (!input.eligibleRole || agent.eligibleRoles.includes(input.eligibleRole)) &&
        (!input.capabilityTag || agent.capabilities.some((capability) => capability.tags?.includes(input.capabilityTag!))),
    );
  }

  async saveRuntimeBinding(binding: RuntimeBinding): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO runtime_bindings (id, agent_id, principal_id, runtime_kind, runtime_adapter_id, status, json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        binding.id,
        binding.agentId,
        binding.principalId,
        binding.runtimeKind,
        binding.runtimeAdapterId,
        binding.status,
        JSON.stringify(binding),
        binding.createdAt.iso,
        binding.updatedAt.iso,
      );
  }

  async getRuntimeBinding(id: RuntimeBindingId): Promise<RuntimeBinding | null> {
    return this.getJson<RuntimeBinding>("SELECT json FROM runtime_bindings WHERE id = ?", id);
  }

  async listRuntimeBindings(agentId: AgentId): Promise<RuntimeBinding[]> {
    return this.allJson<RuntimeBinding>("SELECT json FROM runtime_bindings WHERE agent_id = ? ORDER BY rowid ASC", agentId);
  }

  async saveMembership(membership: ProjectMembership): Promise<void> {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO project_memberships (id, project_id, principal_id, agent_id, status, json, joined_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        membership.id,
        membership.projectId,
        membership.principalId,
        membership.agentId ?? null,
        membership.status,
        JSON.stringify(membership),
        membership.joinedAt.iso,
        membership.updatedAt.iso,
      );
  }

  async getMembership(id: MembershipId): Promise<ProjectMembership | null> {
    return this.getJson<ProjectMembership>("SELECT json FROM project_memberships WHERE id = ?", id);
  }

  async listMemberships(projectId: ProjectId): Promise<ProjectMembership[]> {
    return this.allJson<ProjectMembership>("SELECT json FROM project_memberships WHERE project_id = ? ORDER BY rowid ASC", projectId);
  }

  async findMembership(input: FindMembershipInput): Promise<ProjectMembership | null> {
    return (
      (await this.listMemberships(input.projectId)).find(
        (membership) =>
          (!input.principalId || membership.principalId === input.principalId) &&
          (!input.agentId || membership.agentId === input.agentId),
      ) ?? null
    );
  }

  private getJson<T>(sql: string, ...params: string[]): T | null {
    const row = this.db.prepare(sql).get(...params) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as T) : null;
  }

  private allJson<T>(sql: string, ...params: string[]): T[] {
    const rows = this.db.prepare(sql).all(...params) as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as T);
  }
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

function createBoundaryRecord(input: CreateBoundaryInput, status: Boundary["status"]): Boundary {
  const now = nowTimestamp();
  const boundary: Boundary = {
    id: makeId("BoundaryId"),
    projectId: input.projectId ?? makeId("ProjectId", "unscoped_project"),
    version: version("1.0.0"),
    status,
    prohibitedActions: input.prohibitedActions ?? [],
    riskRules: input.riskRules ?? [],
    escalationRules: input.escalationRules ?? [],
    permissionRules: input.permissionRules ?? [],
    defaultRiskLevel: input.defaultRiskLevel ?? "medium",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    ...(input.description ? { description: input.description } : {}),
  };
  validateBoundaryShape(boundary);
  return boundary;
}

async function requireProject(store: ProjectStore, projectId: ProjectId): Promise<Project> {
  const project = await store.getProject(projectId);
  if (!project) throw new ProjectError("PROJECT_NOT_FOUND", `Project not found: ${projectId}`);
  return project;
}

async function requireObjective(store: ProjectStore, objectiveId: ObjectiveId): Promise<Objective> {
  const objective = await store.getObjective(objectiveId);
  if (!objective) throw new ProjectError("OBJECTIVE_NOT_FOUND", `Objective not found: ${objectiveId}`);
  return objective;
}

async function requireBoundary(store: ProjectStore, boundaryId: BoundaryId): Promise<Boundary> {
  const boundary = await store.getBoundary(boundaryId);
  if (!boundary) throw new ProjectError("BOUNDARY_NOT_FOUND", `Boundary not found: ${boundaryId}`);
  return boundary;
}

async function requirePrincipal(store: ProjectStore, principalId: PrincipalId): Promise<Principal> {
  const principal = await store.getPrincipal(principalId);
  if (!principal) throw new ProjectError("PRINCIPAL_NOT_FOUND", `Principal not found: ${principalId}`);
  return principal;
}

async function requireAgent(store: ProjectStore, agentId: AgentId): Promise<Agent> {
  const agent = await store.getAgent(agentId);
  if (!agent) throw new ProjectError("AGENT_NOT_FOUND", `Agent not found: ${agentId}`);
  return agent;
}

async function requireRuntimeBinding(store: ProjectStore, runtimeBindingId: RuntimeBindingId): Promise<RuntimeBinding> {
  const binding = await store.getRuntimeBinding(runtimeBindingId);
  if (!binding) throw new ProjectError("RUNTIME_BINDING_NOT_FOUND", `Runtime binding not found: ${runtimeBindingId}`);
  return binding;
}

async function requireMembership(store: ProjectStore, membershipId: MembershipId): Promise<ProjectMembership> {
  const membership = await store.getMembership(membershipId);
  if (!membership) throw new ProjectError("MEMBERSHIP_NOT_FOUND", `Membership not found: ${membershipId}`);
  return membership;
}

async function assertNoObjectiveCycle(store: ProjectStore, objective: Objective): Promise<void> {
  const seen = new Set<string>([objective.id]);
  let parentId = objective.parentObjectiveId;
  while (parentId) {
    if (seen.has(parentId)) throw new ProjectError("OBJECTIVE_CYCLE_DETECTED", "Objective parent cycle detected");
    seen.add(parentId);
    const parent = await store.getObjective(parentId);
    parentId = parent?.parentObjectiveId;
  }
}

function subjectMatches(rule: BoundaryPermissionRule, input: EvaluateBoundaryActionInput): boolean {
  switch (rule.subject.kind) {
    case "role":
      return Boolean(input.roles?.includes(rule.subject.role));
    case "agent":
      return input.actor === rule.subject.agentId;
    case "principal":
      return input.actor === rule.subject.principalId;
  }
}

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))]!;
}

function maxFlow(left: BoundaryEvaluation["requiredFlow"] | undefined, right: NonNullable<BoundaryEvaluation["requiredFlow"]>): BoundaryEvaluation["requiredFlow"] {
  const order: NonNullable<BoundaryEvaluation["requiredFlow"]>[] = ["direct", "delegate_vote", "structured_negotiation", "guardian_review", "governance_request"];
  if (!left) return right;
  return order[Math.max(order.indexOf(left), order.indexOf(right))]!;
}

function mergePolicyWithBoundary(decision: PolicyDecision, boundary: BoundaryEvaluation): PolicyDecision {
  if (!boundary.requiredFlow || decision.result === "rejected") return decision;
  const current = decision.requiredNextStep?.kind;
  const currentFlow = current && current !== "work_order" && current !== "review_protocol" && current !== "reject" ? current : undefined;
  const required = maxFlow(currentFlow as BoundaryEvaluation["requiredFlow"], boundary.requiredFlow);
  if (!required || required === currentFlow) return decision;
  return {
    ...decision,
    result: policyResultForFlow(required),
    reason: `${decision.reason}; boundary requires ${required}`,
    requiredNextStep: { kind: required, reason: boundary.reasons.join("; ") || "Boundary escalation rule matched" },
  };
}

function policyResultForFlow(flow: NonNullable<BoundaryEvaluation["requiredFlow"]>): PolicyDecision["result"] {
  switch (flow) {
    case "direct":
      return "approved_directly";
    case "delegate_vote":
      return "requires_delegate_vote";
    case "structured_negotiation":
      return "requires_negotiation";
    case "guardian_review":
      return "requires_guardian";
    case "governance_request":
      return "requires_governance";
  }
}

function limit<T>(values: T[], count: number | undefined): T[] {
  return count === undefined ? values : values.slice(0, count);
}

function loadDatabaseSync(): new (filename: string) => DatabaseSync {
  try {
    return (requireModule("node:sqlite") as { DatabaseSync: new (filename: string) => DatabaseSync }).DatabaseSync;
  } catch (error) {
    throw new Error(`SQLite project store requires a Node runtime with node:sqlite support: ${(error as Error).message}`);
  }
}
