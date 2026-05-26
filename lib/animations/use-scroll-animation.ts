'use client';

import type { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type ScrollAnimationConfig = {
  /** Selector resolved within the scope element. Targets one or many elements. */
  selector: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  /** Trigger element/selector for ScrollTrigger. Defaults to the animated element itself. */
  trigger?: string | Element | null;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  toggleActions?: string;
  /** Base delay applied to every matched element. */
  delay?: number;
  /** When the selector matches N elements, each gets (delay ?? 0) + i * stagger. */
  stagger?: number;
  /** Optional media query gating the animation inside gsap.matchMedia. */
  media?: string;
  /**
   * Behavior under prefers-reduced-motion.
   * 'instant' (default) snaps the elements to their `to` state so content stays visible.
   * 'skip' leaves them untouched (use for pure parallax/scrub).
   */
  reducedMotion?: 'skip' | 'instant';
};

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const NO_PREFERENCE_QUERY = '(prefers-reduced-motion: no-preference)';

const combineMedia = (base: string, extra?: string): string =>
  extra ? `${extra} and ${base}` : base;

const resolveTrigger = (
  trigger: ScrollAnimationConfig['trigger'],
  scope: Element,
  fallback: Element
): Element => {
  if (!trigger) return fallback;
  if (typeof trigger === 'string') {
    return scope.querySelector(trigger) ?? fallback;
  }
  return trigger;
};

const buildScrollTrigger = (
  config: ScrollAnimationConfig,
  scope: Element,
  fallbackTrigger: Element
): ScrollTrigger.Vars => ({
  trigger: resolveTrigger(config.trigger, scope, fallbackTrigger),
  start: config.start ?? 'top 86%',
  ...(config.end ? { end: config.end } : {}),
  ...(config.scrub !== undefined
    ? { scrub: config.scrub }
    : { toggleActions: config.toggleActions ?? 'play none none reverse' }),
});

/** Scroll-driven entry/parallax animations with prefers-reduced-motion handling. */
export function useScrollAnimation(
  scopeRef: RefObject<HTMLElement | null>,
  animations: ScrollAnimationConfig | ScrollAnimationConfig[]
): void {
  useGSAP(
    () => {
      const scope = scopeRef.current;
      if (!scope) return;

      const list = Array.isArray(animations) ? animations : [animations];
      const mm = gsap.matchMedia();

      // Reduced motion: apply `to` instantly for any config that opts in (default).
      mm.add(REDUCED_QUERY, () => {
        list.forEach((config) => {
          const mode = config.reducedMotion ?? 'instant';
          if (mode === 'skip') return;
          const targets = gsap.utils.toArray<HTMLElement>(
            config.selector,
            scope
          );
          if (!targets.length) return;
          gsap.set(targets, { ...(config.to ?? {}) });
        });
      });

      // Active animations grouped by their optional media query.
      const groups = new Map<string, ScrollAnimationConfig[]>();
      list.forEach((config) => {
        const key = combineMedia(NO_PREFERENCE_QUERY, config.media);
        const bucket = groups.get(key) ?? [];
        bucket.push(config);
        groups.set(key, bucket);
      });

      groups.forEach((configs, query) => {
        mm.add(query, () => {
          configs.forEach((config) => {
            const targets = gsap.utils.toArray<HTMLElement>(
              config.selector,
              scope
            );
            if (!targets.length) return;

            const baseDelay = config.delay ?? 0;
            const stagger = config.stagger ?? 0;

            targets.forEach((target, index) => {
              const tweenVars: gsap.TweenVars = {
                ...(config.to ?? {}),
                delay: baseDelay + index * stagger,
                scrollTrigger: buildScrollTrigger(config, scope, target),
              };
              gsap.fromTo(target, config.from ?? {}, tweenVars);
            });
          });
        });
      });

      return () => {
        mm.revert();
      };
    },
    { scope: scopeRef }
  );
}
