# Vibly EVM Wallet Login and Address Identity Requirements

## Background

Vibly does not need a separate EVM product line. The requirement is to adapt the current product so EVM wallets and addresses work as first-class login and identity inputs alongside the existing Substrate account path.

The underlying Vibly chain remains Polkadot SDK based. This work covers wallet login, address recognition, signature authentication, identity binding, chain-side address mapping, and indexer readback. It does not introduce an EVM runtime, Ethereum RPC, Solidity contract deployment, bridge, or a new HTTP authority inside `concord`.

## Product Goal

Console exposes one primary login entry:

```text
Connect Wallet
```

Clicking it opens Talisman Connect UI. The user selects a wallet account, signs a Coordinator-generated login message, and receives a unified Vibly identity.

The target login flow is:

```text
Connect Wallet
-> Talisman Connect UI
-> select wallet
-> select account
-> sign login message
-> Coordinator verifies signature
-> Coordinator returns Vibly Identity
-> Console enters authenticated state
```

After login, Console shows the unified identity:

```text
Vibly Identity
EVM: 0x1234...abcd
Substrate: 5F3s...9kLm
Role: Agent / Observer / Reviewer / User
```

If the identity has only one address kind, Console shows only that address.

## Product Principles

- EVM support is an adaptation of the existing Vibly product, not a replacement product.
- Vibly Identity is the product-level identity. Wallet addresses are login and binding credentials, not raw `principalId` values.
- `principalId` remains an internal Coordinator actor/subject identifier and is not itself an authorization proof.
- EVM and Substrate addresses can independently log in to the same Vibly Identity after binding.
- `vibly-coordinator` remains the only HTTP/SSE contract authority. Any OpenAPI or route contract changes belong there and in `@vibly-ai/coordinator-http-contract`.
- `concord` may expose protocol/kernel types or selected adapters only when needed; it must not add HTTP services or product route tables.

## Non-Goals

- Do not implement a full EVM runtime.
- Do not enable `pallet-evm`.
- Do not provide Ethereum RPC.
- Do not support Solidity contract deployment as part of this work.
- Do not implement an asset bridge.
- Do not create a custom wallet picker.
- Do not use RainbowKit as the primary login entry.
- Do not introduce a new `service` principal kind.
- Do not log signatures, nonces, session tokens, seeds, or deployment secrets.

## Identity Model

Vibly Identity is the product-facing identity record:

```ts
type WalletAccountKind = "evm" | "substrate";

type ViblyIdentity = {
  viblyAccountId: string;
  evmAddress?: `0x${string}`;
  substrateAddress?: string;
  primaryAddress: string;
  primaryKind: WalletAccountKind;
  role?: "user" | "agent" | "observer" | "reviewer";
};
```

Rules:

- One Vibly Identity may have one EVM address.
- One Vibly Identity may have one Substrate address.
- EVM address and Substrate address can each be used for login.
- When the same user connects the other address kind later, the address should bind to the existing Vibly Identity.
- EVM addresses use H160 `0x` format.
- EVM addresses are stored lowercase and may be displayed with checksum casing.
- Substrate addresses are normalized internally to `AccountId32`.
- Console may display SS58 addresses.
- Address binding is not the same thing as a `principalId` binding. Runtime authorization still comes from wallet session, agent runtime token, static trusted bootstrap path, chain Guardian resolver, and organization membership/role.

## Console Requirements

### Wallet Entry

Console has one main login button:

```text
Connect Wallet
```

Console must use Talisman Connect UI for wallet selection, installation detection, connection, account selection, and connection result callbacks.

Expected dependencies:

```bash
pnpm add @talismn/connect-ui @talismn/connect-wallets
```

If the installed API differs, implementation follows the installed package types.

### Connected Account Shape

Console normalizes the selected wallet account to:

```ts
type ConnectedWalletAccount = {
  walletName: string;
  kind: WalletAccountKind;
  address: string;
};
```

Recognition rules:

- `0x` plus 40 hex chars means `evm`.
- A Polkadot extension account means `substrate`.

### Login Signing

After account selection, Console requests a Coordinator-generated login message from the contract-owned auth nonce endpoint.

For EVM:

- MVP supports `personal_sign` / EIP-191.
- The implementation should keep room for EIP-712 typed data later.

For Substrate:

- Use the Polkadot extension signer to sign the raw login message.

### Auth State

Console tracks:

```ts
type ViblyAuthState = {
  status: "disconnected" | "connecting" | "signing" | "authenticated";
  walletName?: string;
  evmAddress?: `0x${string}`;
  substrateAddress?: string;
  viblyAccountId?: string;
  sessionToken?: string;
};
```

When the wallet account changes, Console must:

1. Clear the current session.
2. Clear identity state.
3. Return to `disconnected`.
4. Require a fresh signature login.

### Identity Display

After authentication, Console displays:

- Vibly account id.
- Connected wallet name.
- EVM address if present.
- Substrate address if present.
- Current role if known.
- Link/unlink affordances only when the logged-in identity and product policy permit them.

## Coordinator Requirements

Coordinator owns runtime authentication, nonce lifecycle, signature verification, session creation, identity lookup/creation, and binding transaction submission.

The route names below are product requirements. Their authoritative schema must live in `vibly-coordinator` and `@vibly-ai/coordinator-http-contract`, not in `concord`.

### Nonce

Required contract surface:

```text
GET /auth/nonce?address={address}&kind={evm|substrate}
```

Response:

```ts
type GetNonceResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
};
```

Coordinator generates the message. The message must include:

```text
Sign in to Vibly
Address: {address}
Kind: {evm|substrate}
Nonce: {nonce}
Issued At: {iso_datetime}
Expires At: {iso_datetime}
Domain: {console_domain}
Network: {vibly_network}
```

### Login

Required contract surface:

```text
POST /auth/login
```

Request:

```ts
type LoginRequest = {
  address: string;
  kind: WalletAccountKind;
  walletName?: string;
  message: string;
  signature: string;
};
```

Response:

```ts
type LoginResponse = {
  sessionToken: string;
  identity: ViblyIdentity;
};
```

Coordinator must:

1. Check that the nonce exists.
2. Check that the nonce has not expired.
3. Check that the submitted message matches the server-side nonce record.
4. Verify the signature.
5. Check that the recovered signer address matches the request address.
6. Mark the nonce as used.
7. Look up or create the Vibly Identity.
8. Create the session only after successful verification.
9. Return `sessionToken` and `identity`.

### Signature Verification

EVM MVP:

- Support `personal_sign` / EIP-191.
- Verify recovered address against the normalized lowercase request address.
- Preserve a future path for EIP-712.

Substrate MVP:

- Use the existing Polkadot JS verification path.
- Verify address + message + signature.
- Normalize to `AccountId32` for identity lookup and binding.

### Me

Required contract surface:

```text
GET /me
```

Returns the session's Vibly Identity and current product role/membership context.

### Link and Unlink

Required contract surface:

```text
POST /identity/link-evm
POST /identity/unlink-evm
```

MVP binding may work as:

1. The user is already authenticated.
2. The user connects the EVM address to bind.
3. Console asks Coordinator for a binding message or reuses the login proof where policy allows.
4. Coordinator verifies the signature.
5. Coordinator submits a chain transaction linking `H160 -> AccountId32`.
6. Coordinator returns pending/confirmed status through its normal read model.

Unlink must be explicit. Replacing an existing EVM address must be either a dedicated replace action or an `unlink + link` flow.

### Principal and Actor Safety

- Do not add `PrincipalKind = "service"`.
- Wallet login should not let callers submit arbitrary `principalId` in request bodies.
- For wallet-authenticated requests, actor identity must come from the active wallet session and resolved Vibly Identity.
- For agent runtime requests, actor identity must come from the agent runtime token subject.
- Static token behavior, if retained, is a trusted internal bootstrap/admin path and not a public authentication mechanism.

## Chain Requirements

The Polkadot SDK runtime needs an address mapping between EVM H160 and Vibly `AccountId32`.

Mappings:

```text
EvmAddress(H160) -> AccountId32
AccountId32 -> EvmAddress(H160)
```

Events:

```text
EvmAddressLinked {
  account_id: AccountId,
  evm_address: H160,
}

EvmAddressUnlinked {
  account_id: AccountId,
  evm_address: H160,
}
```

Binding rules:

- One EVM address can bind to only one Vibly Account.
- One Vibly Account can bind to only one EVM address by default.
- Rebinding requires explicit replace or unlink + link.
- Rebinding the same existing pair should return either idempotent success or a clear deterministic error.
- MVP may use Coordinator-verified signatures followed by Coordinator-submitted binding transactions.
- Later versions may move to runtime verification of EVM signature proofs.

## Indexer Requirements

Indexer must listen to:

```text
EvmAddressLinked
EvmAddressUnlinked
```

Indexer read models must support identity lookup by:

- `evmAddress`
- `substrateAddress`
- `viblyAccountId`

The Console must not query chain RPC or indexer directly. Console reads identity and binding state through Coordinator views.

## OpenAPI and Shared Type Requirements

The Coordinator HTTP contract must add or update:

```text
GET /auth/nonce
POST /auth/login
GET /me
POST /identity/link-evm
POST /identity/unlink-evm
```

Shared contract types:

```ts
type WalletAccountKind = "evm" | "substrate";
type ViblyIdentity = {
  viblyAccountId: string;
  evmAddress?: `0x${string}`;
  substrateAddress?: string;
  primaryAddress: string;
  primaryKind: WalletAccountKind;
  role?: "user" | "agent" | "observer" | "reviewer";
};
type GetNonceResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
};
type LoginRequest = {
  address: string;
  kind: WalletAccountKind;
  walletName?: string;
  message: string;
  signature: string;
};
type LoginResponse = {
  sessionToken: string;
  identity: ViblyIdentity;
};
```

The above belongs in the Coordinator contract package. `concord` must not become a competing contract source.

## Security Requirements

- Nonces are single-use.
- Nonces expire.
- Login messages are generated by Coordinator.
- Login messages include domain.
- Login messages include network.
- Login messages include address.
- Login messages include address kind.
- Login messages include issued-at and expires-at timestamps.
- Sessions are created only after successful signature verification.
- Wallet account switching clears the current session.
- Logs must not include signature, nonce, or session token.
- Logs must not include secrets, seeds, deployment keys, or private key material.
- EVM address comparison uses normalized lowercase values.
- Display may use checksum addresses.
- Binding transactions must be idempotent or produce deterministic errors.

## Rollout Plan

### Phase 1: Contract and Coordinator Auth

- Add contract schemas in `@vibly-ai/coordinator-http-contract`.
- Implement nonce issuance and storage.
- Implement EVM `personal_sign` verification.
- Implement Substrate signature verification path.
- Implement session creation and `GET /me`.
- Add tests for nonce expiry, nonce reuse, message mismatch, signer mismatch, account switching, and log redaction.

### Phase 2: Console Wallet Login

- Add Talisman Connect UI.
- Replace multiple login entry points with one `Connect Wallet` entry.
- Normalize selected accounts into `ConnectedWalletAccount`.
- Implement EVM and Substrate signing flows.
- Store authenticated identity state.
- Clear session on account change.

### Phase 3: Chain Mapping and Indexer Readback

- Add runtime EVM address mapping storage and events.
- Implement Coordinator-submitted link/unlink transactions.
- Index `EvmAddressLinked` and `EvmAddressUnlinked`.
- Expose identity lookup/readback through Coordinator views.
- Show binding state in Console.

### Phase 4: Binding UX and Hardening

- Add explicit link/unlink UI.
- Add replace flow if product policy allows it.
- Add admin/operator observability for pending and failed binding transactions.
- Add EIP-712 design notes without making it an MVP blocker.

## Repository Ownership

- `vibly-console`: wallet UI, account selection, signing flow, auth state, identity display, link/unlink UX.
- `vibly-coordinator`: auth nonce, login, session, signature verification, identity lookup/creation, binding transaction orchestration, HTTP/SSE contract implementation.
- `@vibly-ai/coordinator-http-contract`: route schemas and shared HTTP contract types.
- Vibly chain runtime: H160 to AccountId32 mapping, link/unlink events, binding rules.
- Vibly indexer: binding event indexing and identity lookup read models.
- `concord`: no HTTP server, no product route table. Optional protocol/kernel types or selected adapter support only if needed by product repos.

## Acceptance Criteria

- Console has one primary `Connect Wallet` button.
- Clicking it opens Talisman Connect UI.
- A user can connect an EVM account through Talisman.
- A user can connect a Substrate account through Talisman.
- A user can complete EVM signature login.
- A user can complete Substrate signature login.
- Coordinator verifies EVM signatures.
- Coordinator verifies Substrate signatures.
- Coordinator returns one unified Vibly Identity.
- Wallet account switching clears the session and requires re-login.
- An EVM address can bind to a Vibly `AccountId32`.
- Runtime emits `EvmAddressLinked` and `EvmAddressUnlinked`.
- Indexer indexes the EVM binding events.
- Coordinator exposes identity and binding readback to Console.
- Console displays Vibly Identity with available EVM/Substrate addresses.
- `typecheck`, `lint`, `test`, and `build` pass in the touched repositories.
