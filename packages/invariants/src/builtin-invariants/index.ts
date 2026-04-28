import type { ProtocolInvariant } from "../types.js";
import { actionInvariants } from "./action.invariants.js";
import { contextInvariants } from "./context.invariants.js";
import { knowledgeInvariants } from "./knowledge.invariants.js";
import { workInvariants } from "./work.invariants.js";
import { reviewInvariants } from "./review.invariants.js";
import { coordinatorInvariants } from "./coordinator.invariants.js";
import { governanceInvariants } from "./governance.invariants.js";

export const builtinInvariants: ProtocolInvariant[] = [
  ...actionInvariants,
  ...contextInvariants,
  ...knowledgeInvariants,
  ...workInvariants,
  ...reviewInvariants,
  ...coordinatorInvariants,
  ...governanceInvariants,
];
