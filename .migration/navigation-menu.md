# navigation-menu

2026-07-09, golden pair via CLI, migrated from Radix NavigationMenu to Base UI NavigationMenu.

## Changed

packages/frontend/src/components/ui/navigation-menu.tsx:1 now imports from `@base-ui/react/navigation-menu`; packages/frontend/src/components/ui/navigation-menu.tsx:7 adds the Base UI positioner model; packages/frontend/src/components/ui/navigation-menu.tsx:95 renders `Portal > Positioner > Popup > Viewport`; packages/frontend/src/components/ui/navigation-menu.tsx:140 maps the old indicator wrapper to Base UI `Icon`.
packages/frontend/src/components/NavBar.tsx:21 and packages/frontend/src/components/NavBar.tsx:29 were migrated from `asChild` to `render`.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/navigation-menu.tsx` returns no matches.

## Left alone

The public wrapper names remain unchanged so existing imports from `@/components/ui/navigation-menu` still work.

## Behavior changes

Base UI NavigationMenu uses a 50ms default hover delay instead of Radix's 200ms delay. The old moving indicator has no exact Base UI equivalent; the wrapper now uses Base UI `Icon` and stale visible/hidden state classes were removed.

## Verify by hand

Tab through the navbar links, click Home and Wallet, and verify focus rings, hover states, and link navigation behave normally.
