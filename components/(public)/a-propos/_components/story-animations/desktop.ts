import type { RefObject } from 'react';
import gsap from 'gsap';
import type { StoryTargets } from './targets';

export function animateDesktop(
  sectionElement: HTMLElement,
  imageColumnRef: RefObject<HTMLDivElement | null>,
  timelineRef: RefObject<HTMLDivElement | null>,
  {
    mainImage,
    credentialCard,
    detailImage,
    statItems,
    heading,
    subtitle,
    timelineLine,
    blocks,
    decorLines,
    signature,
  }: StoryTargets
) {
  if (mainImage) {
    gsap.fromTo(
      mainImage,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      }
    );
  }

  if (credentialCard) {
    gsap.fromTo(
      credentialCard,
      { autoAlpha: 0, y: 40 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        delay: 0.3,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: imageColumnRef.current,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  if (detailImage) {
    gsap.fromTo(
      detailImage,
      { autoAlpha: 0, x: 30, scale: 0.92 },
      {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: 0.9,
        delay: 0.5,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: imageColumnRef.current,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  if (statItems.length) {
    statItems.forEach((stat, i) => {
      gsap.fromTo(
        stat,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          delay: 0.6 + i * 0.12,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: imageColumnRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });
  }

  if (heading) {
    gsap.fromTo(
      heading,
      { autoAlpha: 0, y: 30 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  if (subtitle) {
    gsap.fromTo(
      subtitle,
      { autoAlpha: 0, y: 20 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        delay: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: subtitle,
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
          start: 'top 75%',
          end: 'bottom 60%',
          scrub: 0.5,
        },
      }
    );
  }

  blocks.forEach((block, i) => {
    gsap.fromTo(
      block,
      { autoAlpha: 0, y: 32, x: 16 },
      {
        autoAlpha: 1,
        y: 0,
        x: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: block,
          start: 'top 82%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    if (decorLines[i]) {
      gsap.fromTo(
        decorLines[i],
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.6,
          delay: 0.3,
          ease: 'power2.inOut',
          scrollTrigger: {
            trigger: block,
            start: 'top 78%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }
  });

  if (signature) {
    gsap.fromTo(
      signature,
      { autoAlpha: 0, y: 16 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: signature,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }
}
