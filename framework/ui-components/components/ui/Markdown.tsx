// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";

// Minimal, dependency-free markdown renderer for analyst answers: headings,
// bold, italic, inline code, and bullet/numbered lists. Enough for chat and
// report narratives without pulling in a parser or dangerouslySetInnerHTML.

import { Fragment, type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on **bold**, *italic*, and `code`, keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-elevated px-1 py-0.5 font-mono text-[0.85em] text-info"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function flushList(key: string) {
    if (!list) return;
    const items = list.items;
    const ordered = list.ordered;
    blocks.push(
      ordered ? (
        <ol key={key} className="my-1.5 list-decimal space-y-1 pl-5">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `md-${i}`;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);

    if (h) {
      flushList(`${key}-l`);
      const level = h[1].length;
      const cls =
        level === 1
          ? "text-base font-bold text-fg mt-2"
          : level === 2
            ? "text-sm font-bold text-fg mt-2"
            : "kpi-label mt-2";
      blocks.push(
        <p key={key} className={cls}>
          {renderInline(h[2], key)}
        </p>,
      );
    } else if (ul) {
      if (!list || list.ordered) {
        flushList(`${key}-l`);
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
    } else if (ol) {
      if (!list || !list.ordered) {
        flushList(`${key}-l`);
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1]);
    } else if (line.trim() === "") {
      flushList(`${key}-l`);
    } else {
      flushList(`${key}-l`);
      blocks.push(
        <p key={key} className="my-1 leading-relaxed">
          {renderInline(line, key)}
        </p>,
      );
    }
  });
  flushList("md-final");

  return (
    <div className={`text-sm text-fg/90 ${className ?? ""}`}>{blocks}</div>
  );
}
