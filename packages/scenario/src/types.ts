import type { ProtocolTrace, TraceReplayResult, TraceVerificationReport } from "@concord/trace";

export interface ScenarioFile {
  id: string;
  name: string;
  description?: string;
  deterministic?: boolean;
  store?: { type: "memory" | "sqlite"; path?: string };
  actors: ScenarioActor[];
  goal: ScenarioGoal;
  initialKnowledge?: ScenarioKnowledgeInput[];
  policies: ScenarioPolicyInput[];
  loop: ScenarioLoopStep[];
  expectations?: ScenarioExpectations;
}

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
