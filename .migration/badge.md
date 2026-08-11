# badge

2026-07-09, golden pair via CLI, migrated from Radix Slot polymorphism to Base UI `useRender`.

## Changed

packages/frontend/src/components/ui/badge.tsx:1 and packages/frontend/src/components/ui/badge.tsx:2 now import Base UI `mergeProps` and `useRender`; packages/frontend/src/components/ui/badge.tsx:30 renders via `useRender` while preserving `badgeVariants`.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/badge.tsx` returns no matches.

## Left alone

No app consumers currently import `Badge`, so no call sites needed migration.

## Behavior changes

Polymorphic rendering now uses `render` instead of `asChild`.

## Verify by hand

Where badges are added later, verify normal span rendering and rendered-link badges both receive the expected variant classes and keyboard focus ring.
