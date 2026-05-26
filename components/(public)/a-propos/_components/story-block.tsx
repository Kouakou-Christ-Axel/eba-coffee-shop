import type { StoryBlockData } from './story-blocks';

type StoryBlockProps = {
  block: StoryBlockData;
  /** When false, no decorative trailing line is rendered (used on the last item). */
  showDecorLine: boolean;
};

function StoryBlock({ block, showDecorLine }: StoryBlockProps) {
  return (
    <article data-story-block className="relative pl-12 md:pl-14">
      {/* Timeline dot */}
      <div
        aria-hidden="true"
        className="absolute left-1.5 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-secondary bg-background md:left-2.5 md:h-5 md:w-5"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
      </div>

      {/* Step number */}
      <span className="mb-2 block font-mono text-xs font-medium tracking-wider text-secondary-600/70">
        {block.year}
      </span>

      <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
        {block.title}
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-relaxed text-foreground/70 md:text-[0.95rem] md:leading-relaxed">
        {block.text}
      </p>

      {/* Decorative line under text */}
      {showDecorLine && (
        <div
          data-decor-line
          aria-hidden="true"
          className="mt-5 h-px w-16 origin-left bg-primary/15 md:mt-6"
        />
      )}
    </article>
  );
}

export default StoryBlock;
