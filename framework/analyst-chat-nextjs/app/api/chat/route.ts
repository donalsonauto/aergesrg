// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type Anthropic from "@anthropic-ai/sdk";
import { loadData } from "@/lib/data";
import { runAgent, type AgentEvent } from "@/lib/chat/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs fs access for the CSV and the knowledge notes

function sseLine(event: AgentEvent) {
 return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
 const encoder = new TextEncoder();

 // Fail gracefully: a missing or rejected key must never surface a raw SDK
 // error or a stack trace to a non-developer.
 if (!process.env.ANTHROPIC_API_KEY) {
 const stream = new ReadableStream({
 start(controller) {
 controller.enqueue(encoder.encode(sseLine({ type: "error", message: "Your API key is missing or invalid." })));
 controller.close();
 },
 });
 return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
 }

 let body: { messages?: Anthropic.MessageParam[]; store?: string };
 try {
 body = await req.json();
 } catch {
 return Response.json({ error: "Invalid request body." }, { status: 400 });
 }
 const messages = Array.isArray(body.messages) ? body.messages : [];
 if (messages.length === 0) return Response.json({ error: "No message provided." }, { status: 400 });

 const rows = loadData();
 const store = body.store ?? "All";

 const stream = new ReadableStream({
 async start(controller) {
 let closed = false;
 const emit = (event: AgentEvent) => {
 if (closed) return;
 controller.enqueue(encoder.encode(sseLine(event)));
 };
 try {
 await runAgent(messages, rows, store, emit);
 } catch (err) {
 emit({ type: "error", message: err instanceof Error ? err.message : "The analyst hit an unexpected error." });
 } finally {
 closed = true;
 controller.close();
 }
 },
 });

 return new Response(stream, {
 headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
 });
}
