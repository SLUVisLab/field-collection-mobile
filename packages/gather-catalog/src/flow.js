/**
 * `Flow` — the data-driven view selector, and the missing sibling of Basic
 * Catalog `Tabs`: where `Tabs` lets the *user* pick one child, `Flow` renders the
 * one child View whose `when` matches an externally controlled value.
 *
 * Flow is presentation only. It does not decide which View is active, own
 * transitions, or run capabilities — a host-side `FlowController` owns that
 * (see `src/a2ui/flowController.js`). Given an active view token, Flow renders
 * that View.
 *
 * Flow is the A2UI **authoring** primitive for selecting among authored Views.
 * It is not a general React view-switching primitive: a Component that happens
 * to have several internal screens uses ordinary component state, because its
 * views are shipped behavior rather than authored structure.
 *
 * Several tokens may map onto one View (the working statuses of Segment &
 * Measure all render `processingView`), which is why the mapping is an authored
 * list rather than a naming convention.
 */

/**
 * Resolves the View component id a `Flow` should render.
 *
 * Shared by the mobile and web renderers so the two cannot drift: Gather owns
 * the single implementation of this component on both platforms.
 *
 * @param {{ current?: string, views?: Array<{ when: string, view: string }>, fallback?: string }} props
 * @returns {string|null} the View component id to render, or `null` for nothing.
 */
export const resolveFlowView = ({ current, views, fallback } = {}) => {
  const match = (Array.isArray(views) ? views : []).find((entry) => entry?.when === current);
  return match?.view ?? fallback ?? null;
};
