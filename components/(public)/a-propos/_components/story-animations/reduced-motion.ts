import gsap from 'gsap';
import type { StoryTargets } from './targets';

export function applyReducedMotion({
  blocks,
  heading,
  subtitle,
  signature,
  credentialCard,
  detailImage,
  statItems,
  timelineLine,
  decorLines,
}: StoryTargets) {
  gsap.set(
    [
      blocks,
      heading,
      subtitle,
      signature,
      credentialCard,
      detailImage,
      statItems,
    ],
    { autoAlpha: 1, y: 0 }
  );
  if (timelineLine) gsap.set(timelineLine, { scaleY: 1 });
  decorLines.forEach((line) => gsap.set(line, { scaleX: 1 }));
}
