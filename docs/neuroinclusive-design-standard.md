# VKEN Neuroinclusive Design Standard

VKEN treats neuroinclusive design as a baseline for every critique, generated direction, and applied patch. The goal is to reduce cognitive load, sensory overload, ambiguity, and interaction traps while preserving expressive design.

## Principles

1. Predictable structure
   - Navigation, headings, controls, and state changes should behave consistently.
   - Avoid surprise layout shifts, hidden dependencies, and visual patterns that change meaning between screens.

2. Cognitive clarity
   - Use direct labels, short task paths, and visible progress.
   - Prefer one primary action per region.
   - Keep instructions close to the controls they explain.

3. Sensory safety
   - Do not use flashing, rapid pulsing, or aggressive parallax.
   - Respect `prefers-reduced-motion`.
   - Keep contrast accessible without relying on harsh color-only emphasis.

4. Focus and recovery
   - Every interactive element must be keyboard reachable.
   - Focus states must be visible.
   - Destructive actions need confirmation or undo.
   - Validation errors should identify the field, the issue, and the next action.

5. Flexible reading
   - Use readable line lengths and stable text hierarchy.
   - Avoid dense all-caps blocks, tiny labels, and hover-only explanatory text.
   - Support scanning with headings, lists, and plain language.

## Critique Checklist

- Is the main task obvious within one glance?
- Can a keyboard user complete the flow?
- Does the page avoid flashing and uncontrolled motion?
- Are labels specific enough without relying on memory?
- Are errors recoverable and tied to their controls?
- Are spacing, contrast, and line length comfortable under normal zoom?
- Does the UI remain understandable without color alone?

## Patch Requirements

When VKEN applies code changes, patches should preserve or improve:

- semantic headings and landmarks
- ARIA only where native HTML is insufficient
- visible focus states
- reduced-motion fallbacks
- consistent spacing and component behavior
- stable responsive layouts
- clear empty, loading, success, and failure states

## Anti-Patterns

- decorative motion that competes with task focus
- hidden controls that appear only on hover
- icon-only actions without an accessible name
- dense modal stacks
- error copy that says only "invalid" or "failed"
- color-only status indicators
- auto-playing media or animation without user control
