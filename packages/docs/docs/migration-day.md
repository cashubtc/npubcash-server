---
title: "Migration day, everything you need to know"
description: "Live guidance for the August 7, 2026 npub.cash v2 migration."
outline: deep
---

# Migration day, everything you need to know <Badge type="danger" text="August 7, 2026" />

Today, `npub.cash` moves from the v1 service to v2. This page is the day-of
overview: what is happening, when it happens, and what you need to do.

::: danger Current status: scheduled
The cutover is scheduled for **15:00 UTC (17:00 CEST)** today. Until then,
`npub.cash` serves v1 and `npubx.cash` serves v2.
:::

## Today's timeline

| Time | What happens |
| --- | --- |
| Before 15:00 UTC | `npub.cash` serves v1 and `npubx.cash` serves v2. |
| At 15:00 UTC | `npub.cash` switches to v2 and the v1 API is retired. |
| After 15:00 UTC | `npub.cash` is the canonical v2 domain; `npubx.cash` remains a compatibility domain through December 31, 2026. |

## User funds

Legacy user funds will be migrated **gradually and automatically after the
cutoff**. You do not need to trigger the migration, but you should not expect
all funds to appear immediately.

The deliberate pace lets us check every proof in the old database, recover sats
from incomplete withdrawals where possible, and preserve user privacy while
communicating with the mint. See [how user funds will be
migrated](/docs/migration#user-funds) for details.

## What you need to do

### I use the v1 API at `npub.cash`

You must migrate; v2 is not a drop-in endpoint replacement. Follow the [v1 to
v2 migration instructions](/docs/migration#if-you-use-npub-cash-v1), including
the required wallet-owned [quote collection
flow](/docs/migration#required-v2-collection-flow).

### I already use v2 at `npubx.cash`

The v2 API does not change. Move to the canonical `npub.cash` domain after the
cutover by following the [v2 domain migration
steps](/docs/migration#if-you-use-npubx-cash-v2).

### I maintain a wallet or SDK integration

Use the production guide's [collection
flow](/docs/migration#required-v2-collection-flow) and [transition
checklist](/docs/migration#recommended-dual-service-transition) as the source
of truth for implementation and recovery behavior.

## Migration updates

The newest update should be added at the top of this table. Times are UTC.

| Time | Status | Update |
| --- | --- | --- |
| Before 15:00 | Scheduled | Cutover remains scheduled for 15:00 UTC. |

<!--
Day-of maintainers: update the status callout near the top of this page and add
new entries above the existing row. Suggested states: Scheduled, In progress,
Monitoring, Complete, or Incident.
-->

## Detailed guidance

The [production migration guide](/docs/migration) is the source of truth for
API differences, client implementation, domain selection, and troubleshooting.
