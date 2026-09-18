/**
 * The site's ambient animated background.
 *
 * A warm gradient base, four slow-drifting pools of gold and berry light,
 * two layers of drifting "sugar dust", a sheen to knit them together, film
 * grain for a papery finish, and a soft vignette. Order matters — the
 * children below are listed in paint order, back to front.
 *
 * Deliberately a plain server component with no client JavaScript: the
 * whole effect is CSS (see the "Ambient motion" section in globals.css),
 * so it costs nothing in bundle size and never delays hydration.
 *
 * `aria-hidden` and `pointer-events: none` (applied in CSS) keep it out of
 * the accessibility tree and out of the way of clicks — it is decoration,
 * and it sits behind every page rather than being part of any of them.
 *
 * Motion is suppressed entirely under `prefers-reduced-motion: reduce`,
 * which leaves a still, layered gradient rather than a blank panel.
 */
export function AnimatedBackground() {
  return (
    <div className="pd-bg" aria-hidden="true">
      {/* Colour: the drifting aurora. */}
      <span className="pd-bg__orb pd-bg__orb--gold" />
      <span className="pd-bg__orb pd-bg__orb--berry" />
      <span className="pd-bg__orb pd-bg__orb--warm" />
      <span className="pd-bg__orb pd-bg__orb--rose" />

      {/* Light: unifies the orbs into a single surface. */}
      <span className="pd-bg__sheen" />

      {/* Motion detail: two parallax dust fields. */}
      <span className="pd-bg__dust" />
      <span className="pd-bg__dust pd-bg__dust--fine" />

      {/* Finish: paper grain, then a centre of gravity. */}
      <span className="pd-bg__grain" />
      <span className="pd-bg__vignette" />
    </div>
  );
}
