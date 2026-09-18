// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import type { Row } from "@/lib/data";
import { computeHighlights, GENERIC_STARTERS } from "@/lib/chat/highlights";
import { Markdown } from "@/lib/chat/markdown";

const TOOL_LABELS: Record<string, string> = {
 list_stores: "Listing stores",
 get_kpi: "Fetching KPI",
 get_kpi_timeline: "Fetching trend",
 get_source_rollup: "Rolling up sources",
 get_revenue_recovery: "Calculating revenue recovery",
 drilldown: "Drilling down",
 search_knowledge: "Searching knowledge base",
};

type Entry =
 | { kind: "user"; id: string; text: string }
 | { kind: "text"; id: string; text: string }
 | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; result?: unknown; truncated?: boolean; status: "running" | "done" }
 | { kind: "error"; id: string; text: string }
 | { kind: "note"; id: string; text: string };

function ToolCard({ entry }: { entry: Extract<Entry, { kind: "tool" }> }) {
 if (entry.name === "think") {
 const thought = typeof entry.input.thought === "string" ? entry.input.thought : "";
 return <div className="tool-card think"><em>Thinking - {thought}</em></div>;
 }
 const label = TOOL_LABELS[entry.name] ?? entry.name;
 const detail = Object.entries(entry.input)
 .filter(([k]) => k !== "years")
 .map(([k, v]) => `${k}: ${v}`)
 .join(", ");
 return (
 <details className="tool-card" open={entry.status === "running"}>
 <summary>
 <span className={"tool-dot " + entry.status} />
 {label}{detail ? ` (${detail})` : ""}
 {entry.status === "running" ? "..." : ""}
 </summary>
 {entry.result !== undefined && (
 <>
 {entry.truncated && <p className="tool-truncated">Result was large and got trimmed.</p>}
 <pre>{JSON.stringify(entry.result, null, 1)}</pre>
 </>
 )}
 </details>
 );
}

export default function ChatPanel({ rows, store }: { rows: Row[]; store: string }) {
 const [available, setAvailable] = useState<boolean | null>(null);
 const [entries, setEntries] = useState<Entry[]>([]);
 const [input, setInput] = useState("");
 const [busy, setBusy] = useState(false);
 const historyRef = useRef<Anthropic.MessageParam[]>([]);
 const currentTextId = useRef<string | null>(null);
 const scrollRef = useRef<HTMLDivElement>(null);
 const idCounter = useRef(0);
 const nextId = () => `e${idCounter.current++}`;

 useEffect(() => {
 fetch("/api/chat/status").then(r => r.json()).then(d => setAvailable(Boolean(d.available))).catch(() => setAvailable(false));
 }, []);

 useEffect(() => {
 scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
 }, [entries]);

 const highlights = useMemo(() => computeHighlights(rows, store), [rows, store]);
 const chips = highlights.length ? highlights.map(h => h.question) : GENERIC_STARTERS;

 async function send(question: string) {
 if (!question.trim() || busy) return;
 setBusy(true);
 const userId = nextId();
 setEntries(prev => [...prev, { kind: "user", id: userId, text: question }]);
 setInput("");
 currentTextId.current = null;

 const newUserMessage: Anthropic.MessageParam = { role: "user", content: question };
 const outgoing = [...historyRef.current, newUserMessage];

 try {
 const res = await fetch("/api/chat", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ messages: outgoing, store }),
 });
 if (!res.body) throw new Error("No response stream.");
 const reader = res.body.getReader();
 const decoder = new TextDecoder();
 let buffer = "";
 for (;;) {
 const { value, done } = await reader.read();
 if (done) break;
 buffer += decoder.decode(value, { stream: true });
 const lines = buffer.split("\n\n");
 buffer = lines.pop() ?? "";
 for (const line of lines) {
 if (!line.startsWith("data: ")) continue;
 const evt = JSON.parse(line.slice(6));
 handleEvent(evt);
 }
 }
 } catch {
 setEntries(prev => [...prev, { kind: "error", id: nextId(), text: "Could not reach the analyst. Check that the dev server and your connection are up." }]);
 } finally {
 setBusy(false);
 }
 }

 function handleEvent(evt: { type: string; [k: string]: unknown }) {
 if (evt.type === "text") {
 const text = evt.text as string;
 setEntries(prev => {
 if (currentTextId.current) {
 return prev.map(e => (e.kind === "text" && e.id === currentTextId.current ? { ...e, text: e.text + text } : e));
 }
 const id = nextId();
 currentTextId.current = id;
 return [...prev, { kind: "text", id, text }];
 });
 } else if (evt.type === "tool_start") {
 currentTextId.current = null;
 setEntries(prev => [...prev, { kind: "tool", id: evt.id as string, name: evt.name as string, input: evt.input as Record<string, unknown>, status: "running" }]);
 } else if (evt.type === "tool_result") {
 setEntries(prev => prev.map(e => (e.kind === "tool" && e.id === evt.id ? { ...e, result: evt.result, truncated: Boolean(evt.truncated), status: "done" } : e)));
 } else if (evt.type === "round_limit") {
 setEntries(prev => [...prev, { kind: "note", id: nextId(), text: "Hit the investigation step limit - answering with what was found so far." }]);
 } else if (evt.type === "error") {
 setEntries(prev => [...prev, { kind: "error", id: nextId(), text: evt.message as string }]);
 } else if (evt.type === "done") {
 historyRef.current = evt.history as Anthropic.MessageParam[];
 currentTextId.current = null;
 }
 }

 if (available === null) {
 return <section className="chat-panel"><p className="chat-empty">Checking analyst status...</p></section>;
 }

 if (!available) {
 return (
 <section className="chat-panel chat-empty-state">
 <h3>Add your Anthropic API key to turn on the analyst</h3>
 <p>It stays on this machine (or your own deployment) - never sent anywhere else.</p>
 <ol>
 <li>Sign in at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a></li>
 <li>Create a key</li>
 <li>Paste it into <code>.env.local</code> as <code>ANTHROPIC_API_KEY=...</code>, then restart <code>npm run dev</code></li>
 </ol>
 <p className="chat-empty-note">Deploying to Vercel? Add it with <code>vercel env add ANTHROPIC_API_KEY production</code>, then redeploy - the redeploy step is the one people forget.</p>
 </section>
 );
 }

 return (
 <section className="chat-panel">
 <div className="chat-head"><h2>Analyst</h2><span>Ask about any move in the numbers</span></div>
 <div className="chat-stream" ref={scrollRef}>
 {entries.length === 0 && <p className="chat-empty">Ask a question, or pick one below.</p>}
 {entries.map(e => {
 if (e.kind === "user") return <div key={e.id} className="chat-bubble user">{e.text}</div>;
 if (e.kind === "text") return <div key={e.id} className="chat-bubble assistant"><Markdown text={e.text} /></div>;
 if (e.kind === "tool") return <ToolCard key={e.id} entry={e} />;
 if (e.kind === "error") return <div key={e.id} className="chat-bubble error">{e.text}</div>;
 return <div key={e.id} className="chat-note">{e.text}</div>;
 })}
 {busy && <div className="chat-typing">Working...</div>}
 </div>
 {entries.length === 0 && (
 <div className="chat-chips">
 {chips.map(q => <button key={q} onClick={() => send(q)} disabled={busy}>{q}</button>)}
 </div>
 )}
 <form className="chat-input" onSubmit={e => { e.preventDefault(); send(input); }}>
 <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask the analyst..." disabled={busy} />
 <button type="submit" disabled={busy || !input.trim()}>Send</button>
 </form>
 </section>
 );
}
