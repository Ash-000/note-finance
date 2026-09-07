# Graph Report - note-finance  (2026-09-07)

## Corpus Check
- Corpus is ~8,573 words - fits in a single context window. You may not need a graph.

## Summary
- 72 nodes · 103 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.89)
- Token cost: 850 input · 420 output

## Community Hubs (Navigation)
- Modal Dialogs & Input Forms
- Dashboard Views & Self Checks
- Vite Build & Tooling Setup
- Application Entry & Metadata
- NPM Scripts & Build Tasks
- React & Icon Dependencies
- Theme System & Design Plans
- Transaction List & Icon Mapping
- Vercel SPA Deployment Config

## God Nodes (most connected - your core abstractions)
1. `amountSizeClass()` - 7 edges
2. `App()` - 6 edges
3. `normalizeAmount()` - 6 edges
4. `scripts` - 5 edges
5. `formatAmountInput()` - 5 edges
6. `isDateInPeriod()` - 5 edges
7. `isValidLogin()` - 4 edges
8. `buildDonutStops()` - 4 edges
9. `calculateBudgetStatus()` - 4 edges
10. `react` - 3 edges

## Surprising Connections (you probably didn't know these)
- `FinNote Application` --conceptually_related_to--> `App()`  [INFERRED]
  README.md → src/App.jsx
- `Browser LocalStorage Persistence` --references--> `useStoredState()`  [INFERRED]
  README.md → src/App.jsx
- `FinNote Brand Icon Logo` --conceptually_related_to--> `BrandMark()`  [INFERRED]
  public/finnote-logo.png → src/App.jsx
- `Theme Style Consolidation Plan` --references--> `SettingsPage()`  [INFERRED]
  design-plans/consolidate-theme-styles.md → src/App.jsx
- `Theme Copy Guidelines Plan` --references--> `SettingsPage()`  [INFERRED]
  design-plans/tighten-theme-copy.md → src/App.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client-Side State & Storage Architecture** — readme_local_storage, src_app_usestoredstate, src_app_app [INFERRED 0.85]

## Communities (9 total, 2 thin omitted)

### Community 0 - "Modal Dialogs & Input Forms"
Cohesion: 0.11
Nodes (6): dateLabel, monthLabel, nav, periodOptions, rupiah, today

### Community 1 - "Dashboard Views & Self Checks"
Cohesion: 0.25
Nodes (13): referenceDate, LoginScreen(), MoneyInput(), Summary(), TransactionsPage(), WishlistPage(), amountSizeClass(), buildDonutStops() (+5 more)

### Community 2 - "Vite Build & Tooling Setup"
Cohesion: 0.17
Nodes (11): devDependencies, vite, @vitejs/plugin-react, name, private, type, version, @phosphor-icons/react (+3 more)

### Community 3 - "Application Entry & Metadata"
Cohesion: 0.22
Nodes (8): HTML Single Page Entry, FinNote Brand Icon Logo, FinNote Application, Browser LocalStorage Persistence, react, App(), BrandMark(), useStoredState()

### Community 4 - "NPM Scripts & Build Tasks"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

### Community 5 - "React & Icon Dependencies"
Cohesion: 0.50
Nodes (4): dependencies, @phosphor-icons/react, react, react-dom

### Community 6 - "Theme System & Design Plans"
Cohesion: 0.67
Nodes (3): Theme Style Consolidation Plan, Theme Copy Guidelines Plan, SettingsPage()

## Knowledge Gaps
- **24 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 39 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Application Entry & Metadata` to `Modal Dialogs & Input Forms`, `Vite Build & Tooling Setup`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `@phosphor-icons/react` connect `Vite Build & Tooling Setup` to `Modal Dialogs & Input Forms`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `scripts` connect `NPM Scripts & Build Tasks` to `Vite Build & Tooling Setup`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Modal Dialogs & Input Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._