# project

2026-07-09, whole-project Radix to Base UI migration summary.

## Changed

packages/frontend/package.json upgrades `shadcn` to `^4.13.0`, upgrades `@base-ui/react` to `^1.6.0`, and removes `radix-ui`.
packages/frontend/components.json now uses `base-nova`; `bunx --bun shadcn@latest info --json` reports `base: "base"`.
bun.lock was updated with Bun.
Migrated wrappers: button, badge, label, separator, alert-dialog, dropdown-menu, navigation-menu, select.
Consumer sweep changed `asChild` call sites to `render` in packages/frontend/src/routes/index.tsx, packages/frontend/src/components/HistoryCard.tsx, packages/frontend/src/routes/_authed/payments.tsx, packages/frontend/src/routes/_authed/history.tsx, packages/frontend/src/components/NavBar.tsx, and packages/frontend/src/components/ui/combobox.tsx.

## Left alone

packages/frontend/src/components/ui/chart.tsx was intentionally left alone because it wraps Recharts, not Radix.
packages/frontend/src/components/ui/combobox.tsx was already Base UI and was only touched for an internal `Button` consumer prop migration.
Other plain shadcn wrappers without Radix imports were left alone.

## Behavior changes

Polymorphic call sites use Base UI `render` instead of Radix `asChild`.
Dropdown checkbox/radio item close behavior and NavigationMenu hover delay follow Base UI defaults.
Separator is now semantic by default.

## Verification

Passed: `bun run lint` in packages/frontend.
Passed: leftover sweep for `radix-ui`, `@radix-ui`, `IconPlaceholder`, `asChild`, and Radix CSS vars in packages/frontend/src.
Failed before and after migration: `bun run build` in packages/frontend still fails on missing `npubcash-types`, missing `src/routeTree.gen`, and TanStack route type errors.
Failed after migration: root `bun run build` still fails on the same workspace type resolution and frontend route generation errors.

0 wrappers remain on Radix.
