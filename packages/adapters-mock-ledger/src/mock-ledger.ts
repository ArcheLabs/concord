import { makeId, nowTimestamp } from "@vibly-ai/concord-foundation";
import type { ActorId, LedgerAccountId, ProjectId } from "@vibly-ai/concord-foundation";
import type { LedgerAccount, LedgerEntry, LedgerEntryKind } from "./types.js";

export class MockLedger {
  private accounts = new Map<string, LedgerAccount>();
  private entries: LedgerEntry[] = [];

  getOrCreateAccount(owner: ActorId | ProjectId): LedgerAccount {
    const existing = [...this.accounts.values()].find((a) => a.owner === owner);
    if (existing) return existing;
    const account: LedgerAccount = {
      id: makeId("LedgerAccountId"),
      owner,
      balances: {},
      reserved: {},
    };
    this.accounts.set(account.id, account);
    return account;
  }

  getAccount(id: LedgerAccountId): LedgerAccount | undefined {
    return this.accounts.get(id);
  }

  getAccountByOwner(owner: ActorId | ProjectId): LedgerAccount | undefined {
    return [...this.accounts.values()].find((a) => a.owner === owner);
  }

  credit(owner: ActorId | ProjectId, asset: string, amount: string, relatedId?: string): LedgerEntry {
    const account = this.getOrCreateAccount(owner);
    const current = BigInt(account.balances[asset] ?? "0");
    account.balances[asset] = String(current + BigInt(amount));
    this.accounts.set(account.id, account);
    return this.addEntry(account.id, "credit", asset, amount, relatedId);
  }

  debit(owner: ActorId | ProjectId, asset: string, amount: string, relatedId?: string): LedgerEntry {
    const account = this.getOrCreateAccount(owner);
    const current = BigInt(account.balances[asset] ?? "0");
    const debitAmt = BigInt(amount);
    if (current < debitAmt) {
      throw new Error(`Insufficient balance: ${current} < ${debitAmt} for ${asset} on account ${account.id}`);
    }
    account.balances[asset] = String(current - debitAmt);
    this.accounts.set(account.id, account);
    return this.addEntry(account.id, "debit", asset, amount, relatedId);
  }

  reserve(owner: ActorId | ProjectId, asset: string, amount: string, relatedId?: string): LedgerEntry {
    const account = this.getOrCreateAccount(owner);
    const balance = BigInt(account.balances[asset] ?? "0");
    const existingReserved = BigInt(account.reserved[asset] ?? "0");
    const reserveAmt = BigInt(amount);
    const available = balance - existingReserved;
    if (available < reserveAmt) {
      throw new Error(`Insufficient available balance to reserve: ${available} < ${reserveAmt}`);
    }
    account.reserved[asset] = String(existingReserved + reserveAmt);
    this.accounts.set(account.id, account);
    return this.addEntry(account.id, "reserve", asset, amount, relatedId);
  }

  releaseReserve(owner: ActorId | ProjectId, asset: string, amount: string, relatedId?: string): LedgerEntry {
    const account = this.getOrCreateAccount(owner);
    const existing = BigInt(account.reserved[asset] ?? "0");
    const releaseAmt = BigInt(amount);
    account.reserved[asset] = String(existing > releaseAmt ? existing - releaseAmt : BigInt(0));
    this.accounts.set(account.id, account);
    return this.addEntry(account.id, "release", asset, amount, relatedId);
  }

  claim(owner: ActorId | ProjectId, asset: string, amount: string, relatedId?: string): LedgerEntry {
    const account = this.getOrCreateAccount(owner);
    const reserved = BigInt(account.reserved[asset] ?? "0");
    const claimAmt = BigInt(amount);
    const balance = BigInt(account.balances[asset] ?? "0");
    account.reserved[asset] = String(reserved >= claimAmt ? reserved - claimAmt : BigInt(0));
    account.balances[asset] = String(balance >= claimAmt ? balance - claimAmt : BigInt(0));
    this.accounts.set(account.id, account);
    return this.addEntry(account.id, "claim", asset, amount, relatedId);
  }

  getBalance(owner: ActorId | ProjectId, asset: string): string {
    const account = this.getAccountByOwner(owner);
    return account?.balances[asset] ?? "0";
  }

  getReserved(owner: ActorId | ProjectId, asset: string): string {
    const account = this.getAccountByOwner(owner);
    return account?.reserved[asset] ?? "0";
  }

  getEntries(): LedgerEntry[] {
    return [...this.entries];
  }

  private addEntry(
    accountId: LedgerAccountId,
    kind: LedgerEntryKind,
    asset: string,
    amount: string,
    relatedId?: string,
  ): LedgerEntry {
    const entry: LedgerEntry = {
      id: makeId("LedgerEntryId"),
      kind,
      accountId,
      asset,
      amount,
      ...(relatedId !== undefined ? { relatedId } : {}),
      createdAt: nowTimestamp(),
    };
    this.entries.push(entry);
    return entry;
  }
}
