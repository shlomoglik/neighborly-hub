# Neighborly Hub design guidelines

Use [Storybook](docs/storybook.md) to review the components and states before implementing a screen. Start with **Foundations / Neighborly 2b**, **UI / Card**, and **Features / Community / Composites**. Follow the relevant feature story for screen-specific patterns.

## Foundations

- Use semantic theme tokens such as `bg-background`, `bg-card`, `text-muted-foreground`, and `text-destructive`. Reuse the shared buttons, inputs, and cards for their spacing, focus states, and 44 px touch targets.
- Use the typed dictionary for Hebrew, English, and Russian. Let layout follow the reading direction. Keep phone and email values LTR, and use `bdi` for mixed-script user names.
- Check narrow widths in Hebrew and English. Let form fields and titles wrap as needed. In compact read-only contact rows, keep the action beside the value and make the full truncated value available on focus or tap.

## Editable cards and groups of fields

- Group related fields for one editable item in a card. Use a `fieldset` with a `legend` for related form controls. Place the visible group title at the start of the header and associate each field with its label. Keep field errors near their controls.
- Put actions that affect the entire card in its header. Use a trash icon at the header’s inline end for removal (top left in Hebrew, top right in English and Russian). Use a shared icon button with a visible keyboard focus state, a localized accessible name that identifies the item when possible, and `type="button"` inside forms. Give the icon a full touch target.
- Confirm deletion of a saved item. When the editor saves a batch, stage the confirmed removal in the same draft as field edits and apply it on Save. An unsaved card can be discarded directly. Keep page-level actions such as Save and Cancel after the set of cards.

Use **Features / Households / HouseholdWorkspace / Bulk Edit** and **Bulk Edit Ltr** as the reference for editable contact cards. Use synthetic data in stories and check that the header action stays inside the card and ahead of its fields in both directions.
