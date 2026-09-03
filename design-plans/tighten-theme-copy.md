# Make theme copy concrete

Written against: 8535d9029dc895c578be38ce8d06dee39731597c

## Evidence chain

- Surface: Settings theme selector and live theme preview in `src/App.jsx`
- Problem: the selector says “Dua palet minimal untuk seluruh aplikasi,” while the preview uses stacked generic adjectives and “ruang kerja.” The copy could describe almost any product and does not tell users what changes in Arta.
- Design evidence: the product is a personal finance tracker (`README.md`), and the only available choices are Deep Ocean and Cool Grey (`src/App.jsx` and `src/styles.css`). The user-defined intent is stable/professional for Deep Ocean and clean/technology-oriented for Cool Grey.
- Owner: `themeCopy` and the Settings markup in `src/App.jsx`
- Scope and affected surfaces: Settings theme selector and live preview only
- Uncertainty: none

## Design decision

Keep the theme names and intended character, but describe the visible color treatment in short Indonesian copy tied to Arta. Use direct sentences and remove generic SaaS language.

## Reuse

- Existing `themeCopy` object in `SettingsPage`
- Existing selector labels `Deep Ocean` and `Cool Grey`
- Exemplar: concise task copy already used by the empty states in `src/App.jsx`

## Changes

1. `src/App.jsx` in `SettingsPage`
   - Change: replace the helper “Dua palet minimal untuk seluruh aplikasi.” with “Pilih Deep Ocean atau Cool Grey.”
   - Preserve: the “Tema warna” label and both radio choices.
   - Verify: the helper names the available action without design jargon.
2. `src/App.jsx` in `themeCopy`
   - Change: use “Biru tenang untuk catatan keuangan yang terasa stabil.” for Deep Ocean and “Abu bersih dengan aksen cyan untuk tampilan yang ringan.” for Cool Grey.
   - Preserve: each theme’s user-provided mood and palette identity.
   - Verify: the preview describes a visible property of the selected theme.
3. `src/App.jsx` in `.preview-copy`
   - Change: replace “Diterapkan langsung ke seluruh ruang kerja.” with “Tema langsung dipakai di seluruh halaman.”
   - Preserve: immediate live-preview behavior.
   - Verify: the sentence is specific to the application and remains short on mobile.

## Scope

- Inherit: live preview text for both themes
- Verify: Settings at desktop and mobile widths
- Exclude: login, transaction, wishlist, destructive-action, validation, and toast copy

## Validation

- Product: select both themes and confirm the preview names and describes the active choice
- Interface: verify neither description wraps beyond the preview content area at 390px and 1440px
- System: keep one `themeCopy` owner; do not introduce a copy abstraction or translation layer
- Repository: `npm test && npm run build` → self-check and production build both pass

## Stop conditions

- Stop if the product owner wants the original adjective lists preserved verbatim.

## Design documentation

- After acceptance and validation: none.
