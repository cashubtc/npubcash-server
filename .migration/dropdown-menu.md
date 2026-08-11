# dropdown-menu

2026-07-09, golden pair via CLI, migrated from Radix DropdownMenu to Base UI Menu.

## Changed

packages/frontend/src/components/ui/dropdown-menu.tsx:2 now imports `Menu` from `@base-ui/react/menu`; packages/frontend/src/components/ui/dropdown-menu.tsx:19 splits content into `Portal > Positioner > Popup`; packages/frontend/src/components/ui/dropdown-menu.tsx:97 maps submenus to `SubmenuRoot`; packages/frontend/src/components/ui/dropdown-menu.tsx:146 and packages/frontend/src/components/ui/dropdown-menu.tsx:189 use Base UI checkbox/radio item indicators.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/dropdown-menu.tsx` returns no matches.

## Left alone

No app dropdown-menu consumers were present, so no call sites needed migration.

## Behavior changes

Base UI checkbox and radio menu items do not close on click by default. This is flagged and left as Base UI's default behavior.

## Verify by hand

Open a dropdown menu, use arrow keys and typeahead, open a submenu, toggle checkbox/radio items, and confirm focus returns to the trigger on close.
