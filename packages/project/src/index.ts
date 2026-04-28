import { DatabaseSync } from "node:sqlite";
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
    this.db = db ?? new DatabaseSync(filename);
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

function limit<T>(values: T[], count: number | undefined): T[] {
  return count === undefined ? values : values.slice(0, count);
}
