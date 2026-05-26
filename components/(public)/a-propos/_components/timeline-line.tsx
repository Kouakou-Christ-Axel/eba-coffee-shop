import type { RefObject } from 'react';

type TimelineLineProps = {
  /** Forwarded onto the wrapper that GSAP uses as the scrub trigger. */
  ref?: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
};

/**
 * Wraps the timeline blocks. The wrapper carries the ref consumed by the
 * parent's GSAP `ScrollTrigger`, and renders the vertical animated line
 * (target via `data-timeline-line`) that scrubs from 0 to 1 with scroll.
 */
function TimelineLine({ ref, children }: TimelineLineProps) {
  return (
    <div ref={ref} className="relative mt-10 md:mt-12">
      {/* Vertical timeline line */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-4 top-0 w-px origin-top md:left-5"
      >
        <div
          data-timeline-line
          className="h-full w-full origin-top bg-linear-to-b from-secondary via-primary/30 to-transparent"
        />
      </div>

      <div className="space-y-6 md:space-y-8">{children}</div>
    </div>
  );
}

export default TimelineLine;
