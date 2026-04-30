/**
 * Thin GraphQL client for the SubQuery query service.
 *
 * Uses graphql-request for a minimal footprint. No codegen required:
 * queries are typed via inline type assertions.
 */

import { GraphQLClient, gql } from "graphql-request";

// ─── Raw response shapes ──────────────────────────────────────────────────────

export interface RawGovernanceSubject {
  id: string;
  chainId: string;
  referendumIndex: number;
  status: string;
  track: number;
  submittedAt: string;
  decidingSince: string | null;
  confirmingSince: string | null;
  endsAt: string | null;
  decidedAt: string | null;
  proposalHash: string | null;
  proposalLen: number | null;
  ayeVotes: string;
  nayVotes: string;
  abstainVotes: string;
  supportPct: number | null;
  updatedAt: string;
}

export interface RawGovernanceCheckpoint {
  id: string;
  blockNumber: string;
  blockHash: string;
  updatedAt: string;
}

export interface SubjectsPage {
  nodes: RawGovernanceSubject[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class SubQueryClient {
  private readonly gql: GraphQLClient;

  constructor(endpoint: string) {
    this.gql = new GraphQLClient(endpoint);
  }

  async getCheckpoint(
    chainId: string,
  ): Promise<RawGovernanceCheckpoint | null> {
    const query = gql`
      query Checkpoint($id: String!) {
        governanceCheckpoint(id: $id) {
          id
          blockNumber
          blockHash
          updatedAt
        }
      }
    `;
    const data = await this.gql.request<{
      governanceCheckpoint: RawGovernanceCheckpoint | null;
    }>(query, { id: chainId });
    return data.governanceCheckpoint;
  }

  async getSubject(
    id: string,
  ): Promise<RawGovernanceSubject | null> {
    const query = gql`
      query Subject($id: String!) {
        governanceSubject(id: $id) {
          id chainId referendumIndex status track submittedAt
          decidingSince confirmingSince endsAt decidedAt
          proposalHash proposalLen ayeVotes nayVotes abstainVotes supportPct
          updatedAt
        }
      }
    `;
    const data = await this.gql.request<{
      governanceSubject: RawGovernanceSubject | null;
    }>(query, { id });
    return data.governanceSubject;
  }

  async listSubjects(input: {
    chainId: string;
    first?: number;
    after?: string;
  }): Promise<SubjectsPage> {
    const query = gql`
      query Subjects($filter: GovernanceSubjectFilter, $first: Int, $after: Cursor) {
        governanceSubjects(filter: $filter, first: $first, after: $after, orderBy: SUBMITTED_AT_DESC) {
          nodes {
            id chainId referendumIndex status track submittedAt
            decidingSince confirmingSince endsAt decidedAt
            proposalHash proposalLen ayeVotes nayVotes abstainVotes supportPct
            updatedAt
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const data = await this.gql.request<{
      governanceSubjects: SubjectsPage;
    }>(query, {
      filter: { chainId: { equalTo: input.chainId } },
      first: input.first ?? 20,
      after: input.after ?? null,
    });
    return data.governanceSubjects;
  }
}
