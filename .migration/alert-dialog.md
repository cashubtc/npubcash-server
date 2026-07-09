# alert-dialog

2026-07-09, golden pair via CLI, migrated from Radix AlertDialog to Base UI AlertDialog.

## Changed

packages/frontend/src/components/ui/alert-dialog.tsx:2 now imports from `@base-ui/react/alert-dialog`; packages/frontend/src/components/ui/alert-dialog.tsx:23 maps overlay to Base UI `Backdrop`; packages/frontend/src/components/ui/alert-dialog.tsx:39 maps content to Base UI `Popup`; packages/frontend/src/components/ui/alert-dialog.tsx:155 maps cancel to `AlertDialogPrimitive.Close` with `render={<Button />}`.
The local `size` and `AlertDialogMedia` API was preserved by the Base registry shape.
Leftover scan clean: `grep -n "radix-ui\|@radix-ui" packages/frontend/src/components/ui/alert-dialog.tsx` returns no matches.

## Left alone

No app alert-dialog consumers were present, so no call sites needed migration.

## Behavior changes

Base UI AlertDialog focuses the first tabbable element by default; Radix commonly focused cancel first. No local consumer depended on an explicit autofocus prop.

## Verify by hand

Open any alert dialog, confirm focus enters the dialog, Escape closes it, Cancel closes it, and focus returns to the trigger.
