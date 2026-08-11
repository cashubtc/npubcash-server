# button

2026-07-09, golden pair via CLI, migrated from Radix Slot polymorphism to the Base UI Button primitive.

## Changed

packages/frontend/src/components/ui/button.tsx:1 now imports `Button` from `@base-ui/react/button`; packages/frontend/src/components/ui/button.tsx:43 renders `ButtonPrimitive` directly and preserves the existing variant/size API.
packages/frontend/src/routes/index.tsx:64, packages/frontend/src/routes/index.tsx:69, packages/frontend/src/routes/index.tsx:251, packages/frontend/src/components/HistoryCard.tsx:73, packages/frontend/src/components/HistoryCard.tsx:76, packages/frontend/src/routes/_authed/payments.tsx:132, and packages/frontend/src/routes/_authed/history.tsx:66 were migrated from `asChild` to `render`.
packages/frontend/src/components/ui/combobox.tsx:74 was migrated from `asChild` to `render` for the internal combobox trigger button.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/button.tsx` returns no matches.

## Left alone

Button consumers that render ordinary buttons were left unchanged because Base UI Button keeps normal button props.

## Behavior changes

Polymorphic rendering now uses Base UI `render` instead of Radix Slot `asChild`.

## Verify by hand

Open the home page and confirm the Wallet, Claim Username, and Launch Wallet buttons navigate correctly. In the wallet history card and history/payments pages, click each outline navigation button and confirm focus and hover states still look correct.
