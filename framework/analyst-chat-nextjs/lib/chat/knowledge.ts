// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import fs from "node:fs";
import path from "node:path";

export type KnowledgeNote = {
 id: string;
 title: string;
 type: string;
 tags: string[];
 body: string;
};

const DIR = path.join(process.cwd(), "demo-data/knowledge");

let cache: KnowledgeNote[] | null = null;

// Parses "# Title" heading, a "Type: x. Tags: a, b, c." line, and the rest as body.
// The type comes from the note's own declared Type field (its real type), never
// derived from an unrelated numeric column.
function parseNote(id: string, raw: string): KnowledgeNote {
 const lines = raw.split("\n");
 const title = (lines.find(l => l.startsWith("# "))?.slice(2) ?? id).trim();
 const metaLine = lines.find(l => /^Type:/i.test(l.trim()))?.trim() ?? "";
 const typeMatch = metaLine.match(/Type:\s*([^.]+)\./i);
 const tagsMatch = metaLine.match(/Tags:\s*([^.]+)\.?/i);
 const type = (typeMatch?.[1] ?? "note").trim();
 const tags = (tagsMatch?.[1] ?? "").split(",").map(t => t.trim()).filter(Boolean);
 const body = lines.filter(l => !l.startsWith("# ") && !/^Type:/i.test(l.trim())).join("\n").trim();
 return { id, title, type, tags, body };
}

export function loadKnowledge(): KnowledgeNote[] {
 if (cache) return cache;
 if (!fs.existsSync(DIR)) return (cache = []);
 const files = fs.readdirSync(DIR).filter(f => f.endsWith(".md"));
 cache = files.map(f => parseNote(f.replace(/\.md$/, ""), fs.readFileSync(path.join(DIR, f), "utf8")));
 return cache;
}

const STOPWORDS = new Set(["the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "what", "which", "how", "when", "should", "i", "we", "our", "it", "this", "that", "does", "do"]);

function tokenize(s: string): string[] {
 return s.toLowerCase().match(/[a-z0-9%$]+/g)?.filter(t => t.length > 1 && !STOPWORDS.has(t)) ?? [];
}

// Ranks by relevance (keyword overlap across title, tags and body), never by an
// arbitrary column. Zero-dependency keyword search is plenty for a couple dozen notes.
export function searchKnowledge(query: string, limit = 3): (KnowledgeNote & { score: number })[] {
 const qTokens = tokenize(query);
 if (qTokens.length === 0) return [];
 const notes = loadKnowledge();
 const scored = notes.map(note => {
 const titleTokens = tokenize(note.title);
 const tagTokens = note.tags.flatMap(t => tokenize(t));
 const bodyTokens = tokenize(note.body);
 let score = 0;
 for (const qt of qTokens) {
 if (titleTokens.includes(qt)) score += 4;
 if (tagTokens.includes(qt)) score += 3;
 score += bodyTokens.filter(bt => bt === qt).length; // 1 point per body occurrence
 // loose substring credit so "closing ratio" matches "closing-ratio-drop"
 if (note.title.toLowerCase().includes(qt)) score += 1;
 }
 return { ...note, score };
 });
 return scored.filter(n => n.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
