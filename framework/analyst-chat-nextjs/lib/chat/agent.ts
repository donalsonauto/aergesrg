// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import Anthropic from "@anthropic-ai/sdk";
import type { Row } from "@/lib/data";
import { TOOLS, executeTool } from "./tools";
import { buildSystemPrompt } from "./system-prompt";

// One constant so the model is trivially swappable (e.g. to "claude-sonnet-5" for lower cost).
export const MODEL = "claude-opus-5";

const MAX_ROUNDS = 25;
const MAX_TOOL_RESULT_BYTES = 12_000;
const MAX_RETRIES = 3;

export type AgentEvent =
 | { type: "text"; text: string }
 | { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
 | { type: "tool_result"; id: string; name: string; result: unknown; truncated: boolean }
 | { type: "round_limit" }
 | { type: "error"; message: string }
 | { type: "done"; history: Anthropic.MessageParam[] };

function trimResult(result: unknown): { value: unknown; truncated: boolean } {
 const json = JSON.stringify(result);
 if (json.length <= MAX_TOOL_RESULT_BYTES) return { value: result, truncated: false };
 return {
 value: {
 truncated: true,
 note: `Result truncated to ${MAX_TOOL_RESULT_BYTES} bytes (was ${json.length}). Narrow the scope (a store, a shorter window) and call again if you need more.`,
 // Raw text snippet, not re-parsed JSON: slicing mid-structure would not
 // reliably produce valid JSON to parse back.
 preview_text: json.slice(0, MAX_TOOL_RESULT_BYTES - 200),
 },
 truncated: true,
 };
}

function isRetryable(err: unknown): boolean {
 if (err instanceof Anthropic.RateLimitError) return true; // 429
 if (err instanceof Anthropic.APIError) return err.status === 429 || err.status === 529 || (err.status ?? 0) >= 500;
 if (err instanceof Anthropic.APIConnectionError) return true;
 return false;
}

async function sleep(ms: number) {
 return new Promise(resolve => setTimeout(resolve, ms));
}

async function streamWithRetry(client: Anthropic, params: Anthropic.MessageStreamParams, onText: (t: string) => void): Promise<Anthropic.Message> {
 let attempt = 0;
 for (;;) {
 try {
 const stream = client.messages.stream(params);
 stream.on("text", onText);
 return await stream.finalMessage();
 } catch (err) {
 attempt++;
 if (!isRetryable(err) || attempt > MAX_RETRIES) throw err;
 await sleep(500 * 2 ** (attempt - 1));
 }
 }
}

export async function runAgent(userMessages: Anthropic.MessageParam[], rows: Row[], store: string, emit: (e: AgentEvent) => void): Promise<void> {
 const client = new Anthropic();
 const periods = [...new Set(rows.map(r => r.period))].sort();
 const stores = [...new Set(rows.map(r => r.store))];
 const system = buildSystemPrompt({ stores, from: periods[0], to: periods.at(-1)!, latestPeriod: periods.at(-1)! });
 void store; // reserved: a future per-store default scope for the system prompt

 const messages: Anthropic.MessageParam[] = [...userMessages];

 for (let round = 0; round < MAX_ROUNDS; round++) {
 let message: Anthropic.Message;
 try {
 message = await streamWithRetry(
 client,
 { model: MODEL, max_tokens: 8000, system, tools: TOOLS, messages },
 text => emit({ type: "text", text }),
 );
 } catch (err) {
 const msg = err instanceof Anthropic.AuthenticationError
 ? "Your API key is missing or invalid."
 : err instanceof Error ? err.message : "The analyst hit an unexpected error.";
 emit({ type: "error", message: msg });
 return;
 }

 messages.push({ role: "assistant", content: message.content });

 if (message.stop_reason !== "tool_use") {
 emit({ type: "done", history: messages });
 return;
 }

 const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

 // Execute every tool call in this round in parallel.
 const results = await Promise.all(
 toolUses.map(async tu => {
 emit({ type: "tool_start", id: tu.id, name: tu.name, input: (tu.input ?? {}) as Record<string, unknown> });
 let result: unknown;
 try {
 result = executeTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, rows);
 } catch (err) {
 result = { error: err instanceof Error ? err.message : "Tool execution failed." };
 }
 return { tu, ...trimResult(result) };
 }),
 );

 // Stream results back to the client with a small stagger so cards fill in
 // one at a time instead of all at once, then feed them all to the model
 // together as required (all tool_result blocks in a single user message).
 const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
 for (const r of results) {
 await sleep(120);
 emit({ type: "tool_result", id: r.tu.id, name: r.tu.name, result: r.value, truncated: r.truncated });
 toolResultBlocks.push({ type: "tool_result", tool_use_id: r.tu.id, content: JSON.stringify(r.value) });
 }
 messages.push({ role: "user", content: toolResultBlocks });

 if (round === MAX_ROUNDS - 1) {
 emit({ type: "round_limit" });
 emit({ type: "done", history: messages });
 return;
 }
 }
}
