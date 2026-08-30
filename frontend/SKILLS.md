---
name: operational-ui
description: Design and implement high-quality operational intelligence interfaces for PyroClass. Use this skill whenever modifying frontend UI, UX, layout, visual design, dashboards, maps, alerts, anomaly workflows, or interaction patterns.
---

# PyroClass Operational UI Skill

You are working on PyroClass, a satellite thermal anomaly monitoring and operational intelligence platform.

This is NOT a generic SaaS dashboard.

The UI must feel like a serious operational intelligence / geospatial monitoring system used by analysts and operators.

## Core design principles

### 1. Information hierarchy

Prioritize:

1. What requires attention now?
2. Where is it?
3. Why does it matter?
4. What evidence supports it?
5. What should the operator do next?

Do not give every metric equal visual prominence.

### 2. Avoid generic AI-generated dashboard aesthetics

Do NOT:

- overuse rounded cards
- create excessive pill components
- use gradients unless justified
- add decorative glassmorphism
- use unnecessary shadows
- create large KPI cards merely to fill space
- use excessive borders
- make every element a floating card
- use generic "modern SaaS" layouts
- add visual decoration without operational value

The interface should feel deliberate, technical, restrained, and professional.

### 3. Operational workflow first

Design around these workflows:

Detection
→ Triage
→ Investigation
→ Corroboration
→ Classification
→ Escalation
→ Resolution

The interface should make these workflows obvious.

### 4. Maps

The map is a primary operational surface.

Support:

- anomaly clustering
- severity visualization
- confidence visualization
- facility proximity
- persistent-source visualization
- map filtering
- temporal filtering
- selected anomaly state
- map/list synchronization
- zoom-to-result
- geographic context
- layer control
- legend
- selected feature highlighting

Do not let the map become a decorative background.

### 5. Alerts

Alerts should support:

- severity
- confidence
- timestamp
- location
- source
- distance to facility
- anomaly type
- status
- acknowledgement
- assignment
- notes
- evidence
- related anomalies
- escalation

The user should be able to move from an alert directly into investigation.

### 6. State design

Every major component must account for:

- loading
- empty
- error
- stale data
- unavailable data
- partial data
- selected state
- hover state
- keyboard focus
- disabled state

Never design only the happy path.

### 7. Data credibility

Do not make mock data look like real operational data without clearly identifying it.

Display:

- data source
- acquisition time
- processing time
- freshness
- confidence
- sensor/platform where relevant

Avoid fake precision.

### 8. Interaction quality

Prefer:

- keyboard shortcuts
- command palette
- persistent filters
- URL/shareable state
- saved views
- quick search
- contextual actions
- detail drawers
- bulk actions
- undo where appropriate
- sensible defaults

Avoid unnecessary navigation.

### 9. Visual hierarchy

Use typography, spacing, size, position, and contrast to establish hierarchy.

Do not rely on borders and cards to separate everything.

### 10. Accessibility

Maintain:

- sufficient contrast
- visible focus states
- keyboard navigation
- semantic HTML
- ARIA where necessary
- non-color-only status indicators
- usable text sizes

## Implementation rules

Before changing the UI:

1. Inspect the existing frontend architecture.
2. Identify the routing structure.
3. Identify reusable components.
4. Identify the design system/theme.
5. Identify map implementation.
6. Identify data/state management.
7. Identify mock data.
8. Identify existing responsive behavior.
9. Identify existing tests.
10. Identify what can be reused rather than rewritten.

Do NOT rewrite the entire frontend unnecessarily.

## Design process

For major UI changes:

1. Audit the current interface.
2. Identify UX problems.
3. Propose a new information architecture.
4. Define the visual system.
5. Define component changes.
6. Implement incrementally.
7. Run the application.
8. Inspect the rendered result.
9. Fix visual inconsistencies.
10. Verify responsive and interaction states.

Never claim a UI change is complete without visually inspecting the result.

## PyroClass visual direction

The visual language should be:

- technical
- restrained
- high information density
- geospatial
- operational
- trustworthy
- calm under pressure

Avoid:

- cyberpunk
- sci-fi HUD aesthetics
- excessive neon
- gaming UI
- flashy gradients
- generic startup dashboard styling

The product should look credible in front of a government agency, emergency-response organization, or industrial security team.

## Important

When implementing a redesign, preserve existing functionality unless explicitly asked to remove it.

Prefer improving the information architecture and interaction design over simply changing colors.
