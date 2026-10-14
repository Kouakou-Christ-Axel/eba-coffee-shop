'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Pas de HTML brut (react-markdown l'ignore par défaut) : le contenu vient d'un
// modèle qui lit des fichiers non fiables.
const components: Components = {
  p: ({ children }) => (
    <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal pl-5">{children}</ol>
  ),
  h1: ({ children }) => (
    <h3 className="mt-2 mb-1 text-base font-semibold">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-2 mb-1 text-base font-semibold">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mt-2 mb-1 font-semibold">{children}</h4>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border bg-background">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b px-2 py-1.5 align-top">{children}</td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
