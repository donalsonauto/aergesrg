// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type { ReactNode } from "react";

// A small, dependency-free renderer for the analyst's answers: headings,
// bold, inline code, bullet and numbered lists, paragraphs. Enough for the
// kind of answer this chat produces; not a general markdown engine.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
 const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(p => p !== "");
 return parts.map((part, i) => {
 if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
 if (part.startsWith("`") && part.endsWith("`")) return <code key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</code>;
 return <span key={`${keyPrefix}-${i}`}>{part}</span>;
 });
}

export function Markdown({ text }: { text: string }) {
 const blocks = text.trim().split(/\n\s*\n/);
 return (
 <>
 {blocks.map((block, bi) => {
 const lines = block.split("\n").filter(l => l.trim() !== "");
 if (lines.length === 0) return null;
 if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
 return (
 <ul key={bi}>
 {lines.map((l, li) => <li key={li}>{renderInline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</li>)}
 </ul>
 );
 }
 if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
 return (
 <ol key={bi}>
 {lines.map((l, li) => <li key={li}>{renderInline(l.replace(/^\s*\d+[.)]\s+/, ""), `${bi}-${li}`)}</li>)}
 </ol>
 );
 }
 const headingMatch = lines[0].match(/^(#{1,4})\s+(.*)/);
 if (headingMatch && lines.length === 1) {
 const level = headingMatch[1].length;
 const content = renderInline(headingMatch[2], `${bi}-h`);
 if (level <= 2) return <h4 key={bi}>{content}</h4>;
 return <h5 key={bi}>{content}</h5>;
 }
 return <p key={bi}>{renderInline(lines.join(" "), `${bi}-p`)}</p>;
 })}
 </>
 );
}
