# Make the two themes authoritative

Written against: 8535d9029dc895c578be38ce8d06dee39731597c

## Evidence chain

- Surface: `src/App.jsx` summary, transaction, wishlist, settings, and login surfaces rendered through `src/main.jsx`
- Problem: `src/styles.css` builds the current interface through three successive style generations and five separate `@media (max-width: 760px)` blocks. The earlier mobile rule sets the navigation to four columns and hides the wishlist label, while later rules restore five columns and a full-width label. Green-era shadows at `.icon-button:hover` and `.empty-state > span` still reach both active themes because no later rule replaces them.
- Design evidence: `README.md` defines Deep Ocean and Cool Grey as the only themes. The active theme tokens are owned by `[data-theme='deep-ocean']` and `[data-theme='cool-grey']` in `src/styles.css`; the later component rules already use `--accent`, `--highlight`, `--sidebar`, `--hero-*`, and `--shadow`.
- Owner: `src/styles.css`, consumed by every component in `src/App.jsx`
- Scope and affected surfaces: all authenticated pages, login, theme preview, desktop sidebar, mobile navigation, empty states, and the wishlist summary
- Uncertainty: exact computed-style parity must be checked at the listed viewports after the cascade is flattened

## Design decision

Keep one base token section, one component rule per state, and one authoritative block per responsive breakpoint. Preserve the current Deep Ocean and Cool Grey appearance, but replace surviving green-era effects with the active theme tokens. Delete overridden declarations instead of adding another override layer.

## Reuse

- Existing theme tokens: `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--border`, `--accent`, `--accent-strong`, `--accent-2`, `--highlight`, `--sidebar`, `--hero-start`, `--hero-end`, `--hero-text`, `--shadow`
- Existing motion tokens: `--panel-*` and `--stagger-*`
- Exemplar: the theme-aware rules under `/* Minimal palette system */` in `src/styles.css`

## Changes

1. `src/styles.css`
   - Change: move the Deep Ocean defaults into the opening `:root` rule and keep Cool Grey in one adjacent attribute selector; remove the obsolete green token block and `--lime`.
   - Preserve: the exact palette values, semantic income/expense colors, motion tokens, and current typography.
   - Verify: switching themes changes every surface without a flash of green or a stale custom background.
2. `src/styles.css`
   - Change: merge repeated selectors so sidebar, balance card, settings preview, login, and shared cards each have one authoritative base definition plus their intentional breakpoint changes.
   - Preserve: current layout, radii, spacing, animations, and reduced-motion behavior.
   - Verify: computed styles match the current accepted UI at 1440px and 1024px.
3. `src/styles.css`
   - Change: merge the five `max-width: 760px` blocks into one block; keep five mobile navigation columns and the full-width 48px wishlist action as the only declarations for those states.
   - Preserve: bottom safe-area padding, mobile modals, quick actions, numeric sizing, and the 380px fallback.
   - Verify: no hidden wishlist label, no four-column navigation rule, and no horizontal overflow at 320px–760px.
4. `src/styles.css`
   - Change: replace the surviving hardcoded green shadows on interactive buttons and empty-state art with `--shadow` or a `color-mix()` derived from `--accent`.
   - Preserve: the current shadow weight and hover movement.
   - Verify: Deep Ocean shadows read blue and Cool Grey shadows read neutral/cyan.

## Scope

- Inherit: every `src/App.jsx` surface because they share the stylesheet and theme tokens
- Verify: both themes, empty and populated states, all modals, and login before and after a stored session
- Exclude: data behavior, localStorage keys, navigation behavior, component extraction, dependencies, and new visual features

## Validation

- Product: log in, switch themes in Settings, add one income, one expense, and one wishlist item; confirm the theme and responsive actions remain consistent
- Interface: inspect empty and populated summary at 1440×900, 1024×768, 760×900, 390×844, and 320×568; test both themes and reduced motion
- System: search for obsolete `--lime`, `--custom-bg`, `.theme-switch`, `.color-options`, green hex values, duplicate component owners, and duplicate `max-width: 760px` blocks
- Repository: `npm test && npm run build` → self-check and production build both pass

## Stop conditions

- Stop if flattening changes an accepted computed style without a matching surviving rule, or if a supposedly obsolete selector is still rendered by `src/App.jsx`.

## Design documentation

- After acceptance and validation: update `README.md` only if the theme names or palette values change; otherwise none.
