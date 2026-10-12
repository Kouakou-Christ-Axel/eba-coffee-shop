import type { RefObject } from 'react';
import gsap from 'gsap';
import type { StoryTargets } from './targets';

export function animateMobile(
  timelineRef: RefObject<HTMLDivElement | null>,
  { credentialCard, heading, timelineLine, blocks }: StoryTargets
) {
  if (credentialCard) {
    gsap.fromTo(
      credentialCard,
      { autoAlpha: 0, y: 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: credentialCard,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  if (heading) {
    gsap.fromTo(
      heading,
      { autoAlpha: 0, y: 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  if (timelineLine) {
    gsap.fromTo(
      timelineLine,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: timelineRef.current,
          start: 'top 80%',
          end: 'bottom 50%',
          scrub: 0.5,
        },
      }
    );
  }

  blocks.forEach((block, i) => {
    gsap.fromTo(
      block,
      { autoAlpha: i === 0 ? 1 : 0, y: i === 0 ? 0 : 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: block,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  });
}
