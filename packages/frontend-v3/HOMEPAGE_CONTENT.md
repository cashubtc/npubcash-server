# npub.cash homepage content brief

Status: content proposal for `frontend-v3`
Live-site reference audited: 2026-08-05
Primary reference: [npub.cash](https://npub.cash)

## Purpose

The homepage should explain the product to someone who knows Lightning, Nostr, neither, or only one of them. It should answer five questions quickly:

1. What is npub.cash?
2. What address can I use?
3. Why is Cashu involved?
4. How do I receive and claim a payment?
5. What trust assumptions and risks should I understand?

The primary conversion is choosing an independent wallet with an npub.cash integration. The secondary conversion is understanding the payment flow. Claiming a username is useful, but it must not imply that a username or account is required.

## Implementation update: independent wallets

npub.cash will not offer or link to a first-party wallet for this version of the homepage. The page should direct people to independent wallets that have integrated npub.cash:

- [cashu.me](https://cashu.me/) — native beta apps, with the browser wallet at [wallet.cashu.me](https://wallet.cashu.me/)
- [Sovran](https://sovran.money/) — native mobile wallet
- [CDK CLI](https://github.com/cashubtc/cdk/tree/main/crates/cdk-cli) — command-line wallet for developers and advanced users; CDK includes a dedicated `cdk-npubcash` integration

This decision supersedes earlier references in the brief to an npub.cash-hosted wallet or `/wallet` route. The primary CTA is now `Choose a wallet`, targeting the compatible-wallets section on the homepage.

## Product truth from the server

These are the facts the homepage copy must preserve.

- Any valid Nostr public key in `npub` form can be used as the local part of a Lightning address: `npub1…@npub.cash`. The server decodes the npub and uses the provider's default Cashu mint until the user chooses another compatible mint.
- A human-readable `username@npub.cash` is optional. Usernames are lowercased, must be at least three alphanumeric characters, cannot begin with `npub1`, must be available, and can require a Cashu payment when username purchases are enabled.
- A claimed username is also exposed through the server's NIP-05 endpoint, mapping the name to the user's Nostr public key.
- The sender pays a normal LNURL-pay/Lightning address invoice. npub.cash asks the recipient's configured Cashu mint for the invoice, stores the mint quote, and monitors it until payment or expiry.
- Once a quote is paid, the recipient's wallet can discover the paid quote and mint the corresponding Cashu eCash when the recipient comes back online.
- The recipient can therefore be offline while a payment arrives. The sender, npub.cash, the Lightning network, and the Cashu mint still need to be online. Use **receive while offline**, not **offline payment**.
- Quote locking is optional. When the user enables it and the chosen mint supports NUT-20, npub.cash requests a quote locked to the user's public key. Do not say that every balance or payment is locked by default.
- Cashu mints are custodial. The product may reduce the trust placed in the npub.cash service by using compatible locked quotes, but it does not remove trust in the selected mint.
- The live npub.cash LNURL endpoint currently advertises Nostr support and the server validates zap requests and publishes NIP-57 zap receipts when Nostr support is enabled.
- Wallet and settings APIs are authenticated with Nostr signatures via NIP-98, with short-lived JWTs available to avoid repeated signing prompts. The existing frontend also supports browser-extension signers (NIP-07) and remote signers (NIP-46).
- The project is open source under the MIT License.

## Required page structure and proposed copy

### 1. Experimental-software notice

Keep a visible notice above the main navigation until the project owner explicitly decides the current work-in-progress warning is no longer needed.

**Proposed copy**

> npub.cash is experimental software. Use small amounts only. Cashu mints are custodial, and access to funds depends on the mint you use.

**Link label:** `Understand the risks`
**Link target:** the trust and FAQ section on this page, or a dedicated risks page when one exists.

This replaces the live page's all-caps warning with clearer, actionable language while preserving its importance.

### 2. Header and navigation

**Brand:** `npub.cash`

**Brand asset note:** the production header currently pairs the wordmark with a purple-to-pink outlined wallet/Cashu mark served from `/logo.png`. Preserve that recognizable idea if the visual identity remains current, but obtain the original or a vector source before implementation; the asset is not present in `frontend-v3`.

**Required links**

- `Home`
- `Wallets` — anchor link to the compatible-wallets section
- `How it works` — anchor link on the homepage
- `Docs` — only after a working documentation URL is confirmed
- `Source` — [cashubtc/npubcash-server](https://github.com/cashubtc/npubcash-server)

**Primary header action:** `Choose a wallet`

The current homepage exposes Home and a first-party Wallet. The new homepage replaces the wallet route with a compatible-wallets section and keeps the technical explanation and source easy to reach.

### 3. Hero

**Eyebrow**

> Lightning + Cashu + Nostr

**H1**

> A Nostr-native Lightning address for everyone

**Supporting copy**

> Receive Lightning payments at your npub.cash address—even while you're offline. Any Nostr public key works immediately; choose an integrated wallet when you're ready to claim payments.

**Address examples**

> `npub1…@npub.cash`
> `yourname@npub.cash`

Label the second example `optional username` so visitors do not mistake it for a registration requirement.

**Primary CTA:** `Choose a wallet`
**Target:** the compatible-wallets section

**Secondary CTA:** `See how it works`
**Target:** the how-it-works section

**Expectation beneath the actions**

> No separate npub.cash account. Your integrated wallet connects your Nostr signer and keeps your eCash on your device.

Do not use “Create your Lightning address.” An npub-based address already exists before the user chooses or opens a wallet.

### 4. Core benefits

**Section heading**

> Your Nostr identity, now a Lightning address

**Section introduction**

> npub.cash connects a familiar Lightning address to your Nostr public key and a Cashu mint, so payments can wait for you until your wallet is online.

Use these benefit cards:

#### No registration required

> Use any valid npub as `npub1…@npub.cash`. You only need an integrated wallet when you want to claim or manage payments.

#### Receive while offline

> A sender pays over Lightning while npub.cash tracks the paid mint quote. Your wallet can claim the Cashu eCash when you return.

#### Choose your mint

> Use the provider's default Cashu mint or set a compatible preferred mint for future payments.

#### Optional quote locking

> With a NUT-20-compatible mint, you can request quotes locked to your Nostr public key for additional protection.

#### Nostr-native

> Use Nostr signatures to access your wallet, receive compatible zaps, and attach an optional NIP-05 name to your public key.

#### Open source

> Built on open protocols and published under the MIT License. Inspect the code, run your own instance, or contribute.

The current homepage's four ideas—no sign-up, trust minimization, offline receiving, and open source—remain central. The revised cards make the mint choice and the meaning of “Nostr-native” explicit.

### 4a. Compatible wallets

**Section heading**

> Choose where you claim your eCash

**Section introduction**

> npub.cash does not host a wallet. These independent wallets have integrated npub.cash so you can discover paid quotes and claim the eCash with your Nostr identity.

Present three wallet cards:

1. `cashu.me` — label as `Web + native`; link separately to the [browser wallet](https://wallet.cashu.me/) and [native app downloads](https://cashu.me/).
2. `Sovran` — label as `Native mobile`; link to [sovran.money](https://sovran.money/).
3. `CDK CLI` — label as `Command line`; link to the [CDK CLI source and instructions](https://github.com/cashubtc/cdk/tree/main/crates/cdk-cli). Make clear that this is for developers and advanced users rather than presenting it as a consumer mobile app.

Include a note that these are independent projects and their availability and release status are maintained by their respective teams.

### 5. How it works

**Section heading**

> Receive now. Claim when you're ready.

**Section introduction**

> npub.cash implements the Cashu-Address model: Lightning delivers the payment, a Cashu mint prepares the eCash, and your Nostr identity tells the wallet which paid quotes belong to you.

Use a three-step native diagram with accessible text rather than relying on the current externally hosted Excalidraw iframe.

#### Step 1 — Share your address

> Share `npub1…@npub.cash`, or claim a shorter `username@npub.cash` address.

#### Step 2 — Receive over Lightning

> The sender's wallet resolves the address. npub.cash requests an invoice from your configured Cashu mint and monitors the resulting quote for payment.

#### Step 3 — Claim the eCash

> When you return, open an integrated wallet and connect your Nostr signer. It finds your paid quotes and mints the corresponding Cashu eCash from the mint.

**Supporting link:** `Read the technical docs`
Do not publish this link until a working documentation target replaces or restores `https://docs.cashu-address.com/`.

### 6. Trust model

This section is required because the product handles money and the phrase “trust minimized” is otherwise easy to overread.

**Section heading**

> Know what you are trusting

**Proposed copy**

> Cashu eCash is issued by a mint, and that mint is a custodian. npub.cash coordinates the Lightning address and keeps the paid quote available for your wallet; it is not the Cashu mint. If your chosen mint and wallet support NUT-20, you can enable quotes locked to your Nostr public key. Locking is optional and is not enabled for every payment by default.

**Short safety points**

- Start with small amounts.
- Choose a mint you understand and trust.
- Back up any wallet data or recovery material the wallet asks you to protect.
- Quote locking requires compatible mint and wallet support.
- Experimental software can change or fail.

Do not describe npub.cash as trustless, non-custodial, or guaranteed. Do not promise that funds can always be recovered without a documented recovery path.

### 7. Optional username callout

This is a supporting section, not the primary value proposition.

**Heading**

> Prefer a name people can remember?

**Copy**

> Your npub address works without registration. If you want something shorter, claim an available username for `username@npub.cash`. The same name can also resolve to your Nostr public key through NIP-05.

**CTA:** `Choose a compatible wallet`
**Target:** the compatible-wallets section

**Purchase note**

> Username availability and price are shown before purchase. Payment is made with Cashu eCash.

Do not hard-code a username price on the homepage. The feature, price, and payment mint are provider configuration and may change or be disabled.

### 8. FAQ

#### Do I need to sign up?

> No separate npub.cash account is required. Any valid Nostr npub can receive at `npub1…@npub.cash`. Use an integrated wallet and connect your Nostr signer when you want to manage payments.

#### Can I really receive while offline?

> Yes—the recipient's device can be offline. npub.cash requests and tracks the mint quote while the sender pays over Lightning. Your wallet claims the eCash after you reconnect.

#### Where does the money live?

> The Lightning payment goes to a quote from your configured Cashu mint. After payment, your wallet uses that paid quote to mint Cashu eCash. The mint is custodial, while the eCash is stored by your wallet after it is claimed.

#### What does quote locking do?

> If enabled and supported by your mint and wallet, NUT-20 locks the mint quote to your Nostr public key so redeeming it requires valid signatures. It is optional and off by default.

#### What is a Cashu mint?

> A Cashu mint issues and redeems private bearer eCash backed by its Lightning balance. Mints are custodial, so choose one you trust.

#### Does npub.cash provide its own wallet?

> No. npub.cash provides the Lightning address and coordinates paid mint quotes. Use an integrated wallet—cashu.me, Sovran, or the CDK CLI—to discover and claim payments.

#### Are usernames required?

> No. A username is an optional, human-readable alternative to your npub address and can also act as an NIP-05 identifier.

#### Does npub.cash support Nostr zaps?

> The hosted service currently advertises zap support. When Nostr support is enabled, the server validates zap requests and publishes zap receipts after payment.

### 9. Final CTA

**Heading**

> Your npub already has an address

**Copy**

> Pick an integrated wallet, connect your Nostr signer, and claim Lightning payments sent to `npub1…@npub.cash`.

**Primary CTA:** `Choose a wallet`
**Secondary CTA:** `Read how it works`

Avoid the current draft's “Create your Lightning address in seconds”; opening the wallet reveals and manages an address that already works.

### 10. Footer

**Required content**

- `npub.cash`
- `Built with Lightning, Cashu eCash, and Nostr.`
- `Source` — [cashubtc/npubcash-server](https://github.com/cashubtc/npubcash-server)
- `Documentation` — only after the destination is confirmed working
- `Nostr` — the maintainer/project profile currently linked from the live homepage
- `MIT License`
- `Status` or `Experimental` if there is a real status/risk destination

Do not copy social links from the existing frontend draft without confirmation. They conflict with the live homepage and repository maintainer information.

## Metadata and sharing copy

**Document title**

> npub.cash — Nostr-native Lightning addresses

**Meta description**

> Receive Lightning payments at your npub.cash address—even while offline. Use any Nostr public key, or claim a human-readable username.

**Open Graph title**

> Your Nostr public key is a Lightning address

**Open Graph description**

> Receive over Lightning while offline, then claim Cashu eCash with your Nostr-connected wallet.

The live page title is only `npub.cash`, and its description is `A nostr native Lightning Address for everyone`. Preserve the core message while adding the terms people need to understand the page in search and link previews.

## Terminology and claim guardrails

Use these consistently:

- `Nostr`, not `nostr`, in prose.
- `Lightning address`, with a lowercase “address” unless it begins a heading.
- `Cashu eCash`, not just “cash,” and not `e-cash`.
- `npub` for the Nostr-encoded public key.
- `receive while offline`, not `offline payments`.
- `connect a signer` or `choose a wallet`, not `create an account`.
- `claim` or `purchase a username`, not `sign up for a username`.
- `paid mint quote` for what npub.cash records before the wallet mints eCash.
- `optional quote locking`, not `your balance is locked`.

Avoid these unsupported or misleading claims:

- “Trustless”
- “Non-custodial” as a description of the whole system
- “Your funds can never be taken”
- “Completely private” or “anonymous”
- “Every payment is locked to your key”
- “npub.cash stores your eCash until you return”
- “No login needed” without clarifying that no registration is needed but a signer is needed to manage funds

## Comparison with the live homepage

| Live homepage element | Decision for the new homepage | Reason |
| --- | --- | --- |
| Work-in-progress/no-warranty banner | Keep, rewrite as an experimental-software and custodial-mint warning | It is important financial-risk context and the v2 docs also call the API unstable. |
| `npub.cash` brand and Nostr-native Lightning tagline | Keep and elevate to the H1 | This remains the clearest summary of the product. |
| `<npub\|user>@npub.cash` example | Keep, split into npub and optional username examples | The two paths have different requirements and should not appear interchangeable. |
| `Try it!` and `Claim Username` CTAs | Replace with `Choose a wallet` and `See how it works` | npub.cash does not host a wallet; visitors should choose an independent integrated wallet. |
| No sign-up | Keep, clarify as no separate registration | Managing funds still requires a Nostr signer. |
| Trust minimized | Keep only with the NUT-20/optional-locking explanation | Locking is configurable and mint-dependent, and Cashu mints remain custodial. |
| Offline payments | Keep as `Receive while offline` | Only the recipient can be offline; the payment infrastructure remains online. |
| Open source | Keep with the canonical repository and MIT license | The live GitHub URL now redirects to the canonical repository. |
| Cashu-Address explanation | Keep, rewrite around the actual quote lifecycle | The live copy says the server mints and holds eCash, while the current server stores and tracks mint quotes for later wallet claiming. |
| Three-step Alice/Bob flow | Keep the three-step structure, modernize the copy | It is easy to scan, but the existing text contains errors and overstates default locking. |
| Embedded Excalidraw diagram | Replace with a native, accessible diagram when implementing | This avoids an external runtime dependency and duplicates the written three-step explanation cleanly. |
| External Cashu-Address docs link | Block until fixed or replaced | `docs.cashu-address.com` did not resolve during the 2026-08-05 audit. |
| GitHub, X/Twitter, and Nostr footer icons | Keep source and Nostr; verify X/Twitter ownership before publishing | The live page and existing frontend draft point to conflicting social accounts. |

## Items to confirm before implementation

These questions do not block the content brief, but they affect final links or runtime copy.

1. Is the product still explicitly experimental? Until confirmed otherwise, keep the warning.
2. What is the new canonical documentation URL? The live documentation domain currently does not resolve.
3. Which X/Twitter account, if any, is the official project account?
4. Should the footer link to the canonical upstream repository, the deployment owner's fork, or both?
5. Will the new wallet expose preferred-mint selection and NUT-20 quote locking at launch? If not, keep those as explanatory capabilities rather than prominent actions.
6. Is username purchasing enabled on the production instance at launch? The homepage should hide its username CTA if the feature is disabled.
7. Should live LNURL limits be surfaced on the homepage or only at payment time? The hosted endpoint currently allows 1 to 100,000 sats, but these values are configuration and must not be hard-coded.

## Evidence reviewed

### Live production reference

- [npub.cash](https://npub.cash): hero, address format, CTAs, feature list, three-step flow, warning, metadata, and footer destinations.
- Public LNURL response for the maintainer npub: confirms the hosted service currently accepts the npub address, advertises Nostr support, and reports provider-configured send limits.

### Repository sources

- [`../server/src/controller/lnurlController.ts`](../server/src/controller/lnurlController.ts): npub/username resolution, quote creation, zap validation, quote persistence, and subscriptions.
- [`../server/src/domain/user/UserService.ts`](../server/src/domain/user/UserService.ts): immediate npub support, default/preferred mint behavior, and username rules.
- [`../server/src/domain/communicator/CommunicatorService.ts`](../server/src/domain/communicator/CommunicatorService.ts): unlocked versus NUT-20-locked quote creation and paid-quote monitoring.
- [`../server/src/controller/userSettingsController.ts`](../server/src/controller/userSettingsController.ts): preferred mint and optional quote-lock settings.
- [`../server/src/controller/wallet.ts`](../server/src/controller/wallet.ts): paid quote history available to wallets.
- [`../server/src/controller/username.ts`](../server/src/controller/username.ts): optional, paid username claims using Cashu 402.
- [`../server/src/controller/nip05Controller.ts`](../server/src/controller/nip05Controller.ts): NIP-05 name resolution.
- [`../server/src/utils/nostr.ts`](../server/src/utils/nostr.ts): NIP-57 zap request validation and receipt publication.
- [`../server/src/utils/lnurl.ts`](../server/src/utils/lnurl.ts): LNURL metadata, live limits, and advertised Nostr support.
- [`../../README.md`](../../README.md): project purpose, offline-receiving problem, open-source status, roadmap, and maintainer identity.
- [`../frontend/src/routes/index.tsx`](../frontend/src/routes/index.tsx): the newer but not production homepage draft, reviewed as a secondary comparison rather than a source of truth.
- [`../frontend/src/contexts/AuthContext.tsx`](../frontend/src/contexts/AuthContext.tsx): NIP-07 and NIP-46 wallet connection paths.
