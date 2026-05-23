# UI Guidelines

This guide maps implemented features to UI surfaces and component building blocks.

## UI Architecture Overview

- App shell: `src/components/AppShell.tsx`
- Primary navigation: `src/components/Sidebar.tsx`
- Header/breadcrumb/status: `src/components/TopBar.tsx`
- Shared primitives: `src/components/Primitives.tsx` (`Button`, `Field`, `DataTable`, `PageTitle`, `Modal`, `AlertToastStack`)
- Page implementations: `src/features/ui-pages.tsx`
- Route pages mounting those views: `src/app/*/page.tsx`

## Feature-to-UI Mapping

### Authentication
- Feature: Admin sign-in/session
- UI route: `/login`
- Main component: `LoginPage`
- Components used: `Field`, `Button`
- Notes:
  - Keep error messaging inline and immediate.
  - Preserve password reveal/hide affordance.

### Dashboard + Service Visibility
- Feature: Provider health + uptime + routing examples
- UI route: `/dashboard`
- Main component: `DashboardPage`
- Components used:
  - custom cards (`ProviderBigCard`)
  - custom flow visuals (`RoutingDiagram`, `RoutingNode`, `DiagramArrow`)
- Notes:
  - Data auto-refreshes; avoid expensive client-only computations per tick.
  - Keep provider-state color semantics consistent across all pages.

### Configuration Management
- Feature: API key, admin credentials, runtime timers
- UI route: `/configuration`
- Main component: `ConfigurationPage`
- Components used: `PageTitle`, `Button`, `Field`-like patterns
- Notes:
  - Form validation should block invalid timer values before submit.
  - Key visibility/copy controls should remain explicit and reversible.

### Provider Pool Operations
- Feature: Add/edit/delete/toggle providers, health checks
- UI route: `/provider-pool`
- Main component: `ProviderPoolsPage`
- Components used: `PageTitle`, `Button`, `Modal`, `AlertToastStack`
- Notes:
  - Destructive actions require modal confirmation.
  - On provider enable, keep post-save health check behavior.

### Model Mapping Operations
- Feature: Alias definition, provider/model row assignment, row health checks
- UI route: `/model-mapping`
- Main component: `ModelMappingsPage`
- Components used:
  - `PageTitle`, `Button`, `Modal`, `AlertToastStack`
  - local utilities (`SearchableSelect`, `LightSelect`)
- Notes:
  - Preserve search-first model/provider selection UX.
  - Maintain duplicate-row shared health propagation behavior.

### Credential Files Management
- Feature: Inspect/download/delete config files and download zip bundle
- UI route: `/credential-files`
- Main component: `CredentialFilesPage`
- Components used: `DataTable`, `Button`, `Modal`, `PageTitle`
- Notes:
  - Keep both desktop table and mobile card variants consistent.
  - File-view modal should preserve monospace readability.

### Real-Time Log Inspection
- Feature: Live logs, pause/resume, clear, download, mask/unmask payloads
- UI route: `/real-time-logs`
- Main component: `RealtimeLogsPage`
- Components used: `Button`, `Modal`
- Notes:
  - Keep polling cadence conservative (currently 5s).
  - Unmask control should remain user-driven and session-local.

## Component Usage Rules

- Use `Primitives.tsx` components first before introducing new UI atoms.
- Prefer `PageTitle` + action buttons for page-level controls.
- Use `Modal` for destructive/confidence-requiring operations.
- Use `AlertToastStack` for transient save/check feedback.
- Keep typography and color palette aligned with existing styles in `globals.css` and inline style tokens.

## Interaction Guidelines

- Optimistic updates are acceptable only when API rollback/reload is handled (as in provider pools/mappings).
- For long-running actions (health checks/model fetch), show explicit loading/disabled states.
- For data-heavy lists, keep desktop and mobile render paths functionally equivalent.

## API Coupling Rule for UI Features

All backend-integrated UI features must communicate through Next API routes (e.g., `src/app/api/admin/*` or customer-facing `/v1/*` route handlers). UI components should never bypass route handlers to access server internals directly.
