# separator

2026-07-09, golden pair via CLI, migrated from Radix Separator to Base UI Separator.

## Changed

packages/frontend/src/components/ui/separator.tsx:1 now imports `Separator` from `@base-ui/react/separator`; packages/frontend/src/components/ui/separator.tsx:5 keeps the local `orientation` default and drops Radix's `decorative` prop.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/separator.tsx` returns no matches.

## Left alone

packages/frontend/src/components/ui/field.tsx keeps using the local `Separator` wrapper with no call-site prop changes.

## Behavior changes

Base UI Separator is semantic by default; the previous wrapper defaulted Radix `decorative` to true.

## Verify by hand

Inspect field separators visually in forms and confirm horizontal and vertical orientation classes still render as expected.
