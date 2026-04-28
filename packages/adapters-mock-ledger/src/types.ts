import type {
  ActorId,
  LedgerAccountId,
  LedgerEntryId,
  ProjectId,
  Timestamp,
} from "@concord/foundation";

export type LedgerEntryKind =
  | "credit"
  | "debit"
  | "reserve"
  | "release"
  | "claim"
  | "cancel_reserve"
  | "slash";

export interface LedgerAccount {
  id: LedgerAccountId;
  owner: ActorId | ProjectId;
  balances: Record<string, string>; // asset → amount
  reserved: Record<string, string>; // asset → reserved amount
}

export interface LedgerEntry {
  id: LedgerEntryId;
  kind: LedgerEntryKind;
  accountId: LedgerAccountId;
  asset: string;
  amount: string;
  relatedId?: string;
  note?: string;
  createdAt: Timestamp;
}
