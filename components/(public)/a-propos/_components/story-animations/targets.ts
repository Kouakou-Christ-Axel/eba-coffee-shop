import gsap from 'gsap';

export type StoryTargets = ReturnType<typeof collectStoryTargets>;

export function collectStoryTargets(sectionElement: HTMLElement) {
  const blocks = gsap.utils.toArray<HTMLElement>(
    '[data-story-block]',
    sectionElement
  );
  const decorLines = gsap.utils.toArray<HTMLElement>(
    '[data-decor-line]',
    sectionElement
  );
  const heading = sectionElement.querySelector('[data-heading]');
  const subtitle = sectionElement.querySelector('[data-subtitle]');
  const signature = sectionElement.querySelector('[data-signature]');
  const timelineLine = sectionElement.querySelector('[data-timeline-line]');
  const credentialCard = sectionElement.querySelector('[data-credential-card]');
  const detailImage = sectionElement.querySelector('[data-detail-image]');
  const statItems = gsap.utils.toArray<HTMLElement>(
    '[data-stat-item]',
    sectionElement
  );
  const mainImage = sectionElement.querySelector('[data-main-image]');

  return {
    blocks,
    decorLines,
    heading,
    subtitle,
    signature,
    timelineLine,
    credentialCard,
    detailImage,
    statItems,
    mainImage,
  };
}
