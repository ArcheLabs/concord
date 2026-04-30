import { createRequire } from "node:module";
import type {
  KnowledgeCandidate,
  KnowledgeCommit,
  KnowledgeCommitInput,
  KnowledgeDiffInput,
  KnowledgeDiffResult,
  KnowledgeMaterialization,
  KnowledgeScope,
  KnowledgeStore,
  KnowledgeVersion,
} from "@concord/core";
import {
  type ActorId,
  type KnowledgeCandidateId,
  type KnowledgeVersionId,
  makeId,
  nowTimestamp,
  sha256,
} from "@concord/foundation";

type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): unknown;
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown;
  };
};

const requireModule = createRequire(import.meta.url);

export class MemoryKnowledgeStore implements KnowledgeStore {
  private readonly versions = new Map<KnowledgeVersionId, KnowledgeVersion>();
  private readonly candidates = new Map<KnowledgeCandidateId, KnowledgeCandidate>();
  private readonly commits = new Map<string, KnowledgeCommit>();
  private latest: KnowledgeVersion | null = null;

  async seedInitialVersion(input: { id?: KnowledgeVersionId; createdBy: ActorId; seed?: unknown }): Promise<KnowledgeVersion> {
    const version: KnowledgeVersion = {
      id: input.id ?? makeId("KnowledgeVersionId"),
      hash: sha256({ seed: input.seed ?? "concord-bootstrap" }),
      createdAt: nowTimestamp(),
      createdBy: input.createdBy,
      commitIds: [],
    };
    this.versions.set(version.id, version);
    this.latest = version;
    return version;
  }

  async getVersion(id: KnowledgeVersionId): Promise<KnowledgeVersion | null> {
    return this.versions.get(id) ?? null;
  }

  async getLatestVersion(_scope: KnowledgeScope = {}): Promise<KnowledgeVersion | null> {
    return this.latest;
  }

  async getCandidate(id: KnowledgeCandidateId): Promise<KnowledgeCandidate | null> {
    return this.candidates.get(id) ?? null;
  }

  async saveCandidate(candidate: KnowledgeCandidate): Promise<void> {
    this.candidates.set(candidate.id, candidate);
  }

  async commit(input: KnowledgeCommitInput): Promise<KnowledgeVersion> {
    const parent = await this.getVersion(input.parentVersionId);
    if (!parent) {
      throw new Error(`Parent knowledge version not found: ${input.parentVersionId}`);
    }

    const candidates = await this.getCandidatesOrThrow(input.candidateIds);
    const commit: KnowledgeCommit = {
      id: makeId("KnowledgeCommitId"),
      candidateIds: input.candidateIds,
      decisionRecordId: input.decisionRecordId,
      parentVersionId: input.parentVersionId,
      nextVersionHash: sha256({
        parentHash: parent.hash,
        candidates,
        decisionRecordId: input.decisionRecordId,
      }),
    };
    const nextVersion: KnowledgeVersion = {
      id: makeId("KnowledgeVersionId"),
      parentId: parent.id,
      hash: commit.nextVersionHash,
      createdAt: nowTimestamp(),
      createdBy: input.createdBy,
      commitIds: [...parent.commitIds, commit.id],
    };

    this.commits.set(commit.id, commit);
    this.versions.set(nextVersion.id, nextVersion);
    this.latest = nextVersion;
    return nextVersion;
  }

  async diff(input: KnowledgeDiffInput): Promise<KnowledgeDiffResult> {
    const from = await this.getVersion(input.fromVersionId);
    const to = await this.getVersion(input.toVersionId);
    if (!from || !to) {
      throw new Error("Cannot diff missing knowledge versions");
    }
    const fromIds = new Set(from.commitIds);
    const changedCandidateIds = to.commitIds
      .filter((commitId) => !fromIds.has(commitId))
      .flatMap((commitId) => this.commits.get(commitId)?.candidateIds ?? []);
    return { ...input, changedCandidateIds };
  }

  async materialize(input: { versionId: KnowledgeVersionId }): Promise<KnowledgeMaterialization> {
    const version = await this.getVersion(input.versionId);
    if (!version) {
      throw new Error(`Knowledge version not found: ${input.versionId}`);
    }
    const candidates = version.commitIds.flatMap((commitId) => {
      const commit = this.commits.get(commitId);
      return commit?.candidateIds.map((candidateId) => this.candidates.get(candidateId)).filter(isDefined) ?? [];
    });
    return { version, candidates };
  }

  private async getCandidatesOrThrow(ids: KnowledgeCandidateId[]): Promise<KnowledgeCandidate[]> {
    const candidates = await Promise.all(ids.map((id) => this.getCandidate(id)));
    const missingIndex = candidates.findIndex((candidate) => !candidate);
    if (missingIndex >= 0) {
      throw new Error(`Knowledge candidate not found: ${ids[missingIndex]}`);
    }
    return candidates.filter(isDefined);
  }
}

export class SQLiteKnowledgeStore implements KnowledgeStore {
  readonly db: DatabaseSync;

  constructor(filename = ":memory:", db?: DatabaseSync) {
    this.db = db ?? new (loadDatabaseSync())(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_versions (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        commit_ids TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_candidates (
        id TEXT PRIMARY KEY,
        proposed_by TEXT NOT NULL,
        target_layer TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_commits (
        id TEXT PRIMARY KEY,
        parent_version_id TEXT NOT NULL,
        decision_record_id TEXT NOT NULL,
        candidate_ids TEXT NOT NULL,
        json TEXT NOT NULL
      );
    `);
  }

  async seedInitialVersion(input: { id?: KnowledgeVersionId; createdBy: ActorId; seed?: unknown }): Promise<KnowledgeVersion> {
    const existing = await this.getLatestVersion();
    if (existing) {
      return existing;
    }
    const version: KnowledgeVersion = {
      id: input.id ?? makeId("KnowledgeVersionId"),
      hash: sha256({ seed: input.seed ?? "concord-bootstrap" }),
      createdAt: nowTimestamp(),
      createdBy: input.createdBy,
      commitIds: [],
    };
    this.insertVersion(version);
    return version;
  }

  async getVersion(id: KnowledgeVersionId): Promise<KnowledgeVersion | null> {
    const row = this.db.prepare("SELECT json FROM knowledge_versions WHERE id = ?").get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as KnowledgeVersion) : null;
  }

  async getLatestVersion(_scope: KnowledgeScope = {}): Promise<KnowledgeVersion | null> {
    const row = this.db
      .prepare("SELECT json FROM knowledge_versions ORDER BY rowid DESC LIMIT 1")
      .get() as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as KnowledgeVersion) : null;
  }

  async getCandidate(id: KnowledgeCandidateId): Promise<KnowledgeCandidate | null> {
    const row = this.db
      .prepare("SELECT json FROM knowledge_candidates WHERE id = ?")
      .get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as KnowledgeCandidate) : null;
  }

  async saveCandidate(candidate: KnowledgeCandidate): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO knowledge_candidates (id, proposed_by, target_layer, json) VALUES (?, ?, ?, ?)")
      .run(candidate.id, candidate.proposedBy, candidate.targetLayer, JSON.stringify(candidate));
  }

  async commit(input: KnowledgeCommitInput): Promise<KnowledgeVersion> {
    const parent = await this.getVersion(input.parentVersionId);
    if (!parent) {
      throw new Error(`Parent knowledge version not found: ${input.parentVersionId}`);
    }

    const candidates = await this.getCandidatesOrThrow(input.candidateIds);
    const commit: KnowledgeCommit = {
      id: makeId("KnowledgeCommitId"),
      candidateIds: input.candidateIds,
      decisionRecordId: input.decisionRecordId,
      parentVersionId: input.parentVersionId,
      nextVersionHash: sha256({
        parentHash: parent.hash,
        candidates,
        decisionRecordId: input.decisionRecordId,
      }),
    };
    const nextVersion: KnowledgeVersion = {
      id: makeId("KnowledgeVersionId"),
      parentId: parent.id,
      hash: commit.nextVersionHash,
      createdAt: nowTimestamp(),
      createdBy: input.createdBy,
      commitIds: [...parent.commitIds, commit.id],
    };

    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          "INSERT INTO knowledge_commits (id, parent_version_id, decision_record_id, candidate_ids, json) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          commit.id,
          commit.parentVersionId,
          commit.decisionRecordId,
          JSON.stringify(commit.candidateIds),
          JSON.stringify(commit),
        );
      this.insertVersion(nextVersion);
      this.db.exec("COMMIT");
      return nextVersion;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async diff(input: KnowledgeDiffInput): Promise<KnowledgeDiffResult> {
    const from = await this.getVersion(input.fromVersionId);
    const to = await this.getVersion(input.toVersionId);
    if (!from || !to) {
      throw new Error("Cannot diff missing knowledge versions");
    }
    const fromIds = new Set(from.commitIds);
    const changedCandidateIds = to.commitIds
      .filter((commitId) => !fromIds.has(commitId))
      .flatMap((commitId) => this.getCommitCandidateIds(commitId));
    return { ...input, changedCandidateIds };
  }

  async materialize(input: { versionId: KnowledgeVersionId }): Promise<KnowledgeMaterialization> {
    const version = await this.getVersion(input.versionId);
    if (!version) {
      throw new Error(`Knowledge version not found: ${input.versionId}`);
    }
    const candidates = version.commitIds
      .flatMap((commitId) => this.getCommitCandidateIds(commitId))
      .map((candidateId) => {
        const row = this.db
          .prepare("SELECT json FROM knowledge_candidates WHERE id = ?")
          .get(candidateId) as { json: string } | undefined;
        return row ? (JSON.parse(row.json) as KnowledgeCandidate) : undefined;
      })
      .filter(isDefined);
    return { version, candidates };
  }

  private insertVersion(version: KnowledgeVersion): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO knowledge_versions (id, parent_id, hash, created_at, created_by, commit_ids, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        version.id,
        version.parentId ?? null,
        version.hash.value,
        version.createdAt.iso,
        version.createdBy,
        JSON.stringify(version.commitIds),
        JSON.stringify(version),
      );
  }

  private getCommitCandidateIds(commitId: string): KnowledgeCandidateId[] {
    const row = this.db
      .prepare("SELECT candidate_ids FROM knowledge_commits WHERE id = ?")
      .get(commitId) as { candidate_ids: string } | undefined;
    return row ? (JSON.parse(row.candidate_ids) as KnowledgeCandidateId[]) : [];
  }

  private async getCandidatesOrThrow(ids: KnowledgeCandidateId[]): Promise<KnowledgeCandidate[]> {
    const candidates = await Promise.all(ids.map((id) => this.getCandidate(id)));
    const missingIndex = candidates.findIndex((candidate) => !candidate);
    if (missingIndex >= 0) {
      throw new Error(`Knowledge candidate not found: ${ids[missingIndex]}`);
    }
    return candidates.filter(isDefined);
  }
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function loadDatabaseSync(): new (filename: string) => DatabaseSync {
  try {
    return (requireModule("node:sqlite") as { DatabaseSync: new (filename: string) => DatabaseSync }).DatabaseSync;
  } catch (error) {
    throw new Error(`SQLite knowledge store requires a Node runtime with node:sqlite support: ${(error as Error).message}`);
  }
}
