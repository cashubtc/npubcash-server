# select

2026-07-09, golden pair via CLI, migrated from Radix Select to Base UI Select.

## Changed

packages/frontend/src/components/ui/select.tsx:2 now imports from `@base-ui/react/select`; packages/frontend/src/components/ui/select.tsx:7 re-exports `SelectPrimitive.Root`; packages/frontend/src/components/ui/select.tsx:57 splits content into `Portal > Positioner > Popup`; packages/frontend/src/components/ui/select.tsx:82 uses `data-align-trigger` and Base UI positioning vars; packages/frontend/src/components/ui/select.tsx:109 maps item text and indicator to Base UI parts.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/select.tsx` returns no matches.

## Left alone

No app select consumers were present, so no call sites needed migration.

## Behavior changes

Radix `position` is replaced by Base UI `alignItemWithTrigger`; values and `onValueChange` callbacks are wider in Base UI.

## Verify by hand

Open a select, use keyboard navigation and typeahead, choose an item, and confirm the menu positions correctly and returns focus to the trigger.
