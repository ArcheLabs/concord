import type { ProtocolTrace, TraceReplayResult, TraceVerificationReport } from "@concord/trace";

export interface ScenarioFile {
  id: string;
  name: string;
  description?: string;
  deterministic?: boolean;
  store?: { type: "memory" | "sqlite"; path?: string };
  // M9 fields (optional — absent means pure M8 scenario)
  principals?: ScenarioPrincipal[];
  agents?: ScenarioAgent[];
  project?: ScenarioProject;
  objectives?: ScenarioObjective[];
  boundary?: ScenarioBoundary;
  memberships?: ScenarioMembership[];
  // existing M8 fields
  actors: ScenarioActor[];
  goal: ScenarioGoal;
  initialKnowledge?: ScenarioKnowledgeInput[];
  policies: ScenarioPolicyInput[];
  loop: ScenarioLoopStep[];
  expectations?: ScenarioExpectations;
}

// ---------------------------------------------------------------------------
// M9 types
// ---------------------------------------------------------------------------

export interface ScenarioPrincipal {
  id: string;
  kind: "human" | "organization" | "service" | "multisig" | "unknown";
  displayName: string;
  identities?: Array<{ namespace: string; subject: string }>;
}

export interface ScenarioAgent {
  id: string;
  principal: string; // ref to ScenarioPrincipal.id
  displayName: string;
  eligibleRoles?: string[];
  capabilities?: Array<{ name: string; tags?: string[] }>;
  runtime?: {
    id: string;
    kind: string;
    adapterId: string;
    command?: string;
    args?: string[];
    endpoint?: string;
  };
}

export interface ScenarioProject {
  slug: string;
  name: string;
  description?: string;
  sponsor: string; // ref to ScenarioPrincipal.id
}

export interface ScenarioObjective {
  id: string;
  kind: "long_term" | "milestone" | "phase" | "task_cluster" | "experiment";
  title: string;
  description: string;
  status?: "draft" | "active";
  successCriteria: Array<{
    id: string;
    description: string;
    verificationMethod: "human_review" | "agent_review" | "state_observation" | "governance_receipt" | "knowledge_commit" | "manual";
    required: boolean;
  }>;
  forbiddenOutcomes?: string[];
}

export interface ScenarioBoundary {
  defaultRiskLevel?: "low" | "medium" | "high" | "critical";
  prohibitedActions?: Array<{ id: string; actionType: string; effect: "allow" | "deny"; reason: string }>;
  riskRules?: Array<{ id: string; actionType: string; riskLevel: "low" | "medium" | "high" | "critical"; reason: string }>;
  escalationRules?: Array<{ id: string; actionType: string; requiredFlow: string; reason: string }>;
}

export interface ScenarioMembership {
  principal: string; // ref to ScenarioPrincipal.id
  agent?: string;    // ref to ScenarioAgent.id
  roles: string[];
}

// ---------------------------------------------------------------------------
// M8 types (unchanged)
// ---------------------------------------------------------------------------

export interface ScenarioActor {
  id: string;
  kind: "agent" | "human" | "service" | "guardian";
  roles?: string[];
  runtime?: string;
}

export interface ScenarioGoal {
  id?: string;
  title: string;
  description: string;
}

export interface ScenarioKnowledgeInput {
  id: string;
  path: string;
  layer: "bootstrap" | "protocol" | "skill" | "external_input" | "formal" | "deprecated" | "disputed";
}

export interface ScenarioPolicyInput {
  actionType: string;
  decisionFlow:
    | "direct"
    | "delegate_vote"
    | "structured_negotiation"
    | "review_protocol"
    | "governance_request"
    | "guardian_review"
    | "reject";
  votingRule?: { threshold: number; quorum: number };
  produces?: string[];
  resultBinding?: "advisory" | "binding" | "requires_external_execution";
}

export type ScenarioLoopStep =
  | ({ type: "create_context"; actor: string })
  | ({ type: "observe"; actor: string; summary: string })
  | ({ type: "propose_action"; actor: string; actionType: string; title: string; description: string; riskLevel?: "low" | "medium" | "high" | "critical" })
  | ({ type: "evaluate_policy" })
  | ({ type: "delegate_vote"; voters: string[]; vote: "approve" | "reject" | "abstain"; rationale?: string })
  | ({ type: "start_negotiation"; participants?: string[] })
  | ({ type: "submit_negotiation_position"; actor: string; stance: "support" | "oppose" | "abstain" | "revise"; rationale?: string })
  | ({ type: "close_negotiation" })
  | ({ type: "create_work_order"; title: string; assignee?: string; expectedOutputs?: string[] })
  | ({ type: "claim_work"; actor: string })
  | ({ type: "run_runtime"; actor: string; runtime?: string })
  | ({ type: "submit_work"; actor: string; summary?: string })
  | ({ type: "review"; reviewer: string; result: "accept" | "reject" | "needs_revision" | "escalate"; score?: number; rationale: string })
  | ({ type: "create_knowledge_candidate"; actor: string; layer: ScenarioKnowledgeInput["layer"]; summary?: string })
  | ({ type: "commit_knowledge"; actor: string });

export interface ScenarioExpectations {
  verifyTrace?: boolean;
  replayTrace?: boolean;
  invariants?: { mustPass?: string[] };
}

export interface RunScenarioInput {
  scenarioPath: string;
  traceOut?: string;
  verify?: boolean;
  replay?: boolean;
}

export interface RunScenarioResult {
  ok: boolean;
  trace: ProtocolTrace;
  verification?: TraceVerificationReport;
  replay?: TraceReplayResult;
}
