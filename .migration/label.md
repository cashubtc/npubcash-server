# label

2026-07-09, golden pair via CLI, migrated from Radix Label to a native label wrapper.

## Changed

packages/frontend/src/components/ui/label.tsx:5 now types the wrapper as `React.ComponentProps<"label">`; packages/frontend/src/components/ui/label.tsx:7 renders a native `<label>` with the existing styling.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/label.tsx` returns no matches.

## Left alone

packages/frontend/src/components/ui/field.tsx continues to compose the local `Label` wrapper because the public import surface is unchanged.

## Behavior changes

Radix Label's text-selection prevention is replaced by the existing `select-none` class on the native label.

## Verify by hand

For any field using `FieldLabel`, click the label and confirm the associated input still receives focus where an `htmlFor` association is present.
