// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import Anthropic from '@anthropic-ai/sdk';
import { CHAT_MODEL, FALLBACK_MODEL, samplingParams, isModelNotFound, describeAiError, logAiError } from './models.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_TOOL_RESULT_LENGTH = 12000;
const MAX_TOOL_ITERATIONS = 25;

function trimToolResult(result) {
  const str = typeof result === 'string' ? result : JSON.stringify(result);
  if (str.length <= MAX_TOOL_RESULT_LENGTH) return str;
  return str.substring(0, MAX_TOOL_RESULT_LENGTH) + '\n... [truncated]';
}

/**
 * Convert OpenAI-format tool definitions to Anthropic format.
 */
export function convertTools(openaiTools) {
  return openaiTools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters || { type: 'object', properties: {} },
  }));
}

/**
 * Stream a chat with Claude, executing tools in a loop.
 *
 * SSE callbacks:
 *  - onTextDelta(delta)        — final analysis text (for chat)
 *  - onToolStart(name, args, id)
 *  - onToolResult(name, result, id)
 *  - onReportSection(section)  — structured report section after each tool round
 *  - onThinking(text)          — Claude's thinking (optional display)
 *  - onUsage(usage)
 *  - onComplete(fullText, allToolCalls)
 */
export async function streamChat(opts) {
  const {
    systemPrompt,
    messages,
    tools,
    onTextDelta,
    onToolStart,
    onToolResult,
    onReportSection,
    onThinking,
    executeToolFn,
    onUsage,
    onComplete,
  } = opts;

  const PRIMARY_MODEL = CHAT_MODEL;
  const BACKUP_MODEL = FALLBACK_MODEL;
  let model = PRIMARY_MODEL;
  const workingMessages = [...messages];
  const allToolCalls = [];
  let fullText = '';
  let iterations = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let blockIndex = 0; // Global block counter across all iterations

  // Add the think tool for mid-chain reasoning
  const thinkTool = {
    name: 'think',
    description: 'Use this tool to reason about what you have learned so far and plan your next investigation steps. Call this between data-fetching rounds to analyze intermediate results and decide what to check next. This helps you be a better analyst.',
    input_schema: {
      type: 'object',
      properties: {
        analysis: {
          type: 'string',
          description: 'Your analysis of what the data shows so far and what to investigate next',
        },
      },
      required: ['analysis'],
    },
  };

  const allTools = [...tools, thinkTool];

  while (true) {
    iterations++;
    if (iterations > MAX_TOOL_ITERATIONS) break;

    // Collect content blocks from this response
    let currentText = '';
    let currentToolUses = [];
    let currentThinking = '';
    let stopReason = null;
    let activeBlockType = null;
    let activeToolIndex = -1;
    let inputJsonBuf = '';
    let currentBlockIndex = -1; // Block index for the active content block

    // Retry on transient errors (overloaded, rate limit) — wraps both create + stream
    // After 3 retries on primary model, try fallback model 2 more times
    const maxAttempts = 5; // 3 primary + 2 fallback
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Switch to fallback model after primary retries exhausted
        if (attempt === 3 && model === PRIMARY_MODEL) {
          model = BACKUP_MODEL;
          console.log(`[Claude] Primary model unavailable, falling back to ${BACKUP_MODEL}`);
          if (onTextDelta) {
            onTextDelta('\n> *Switching to backup model due to API issues...*\n\n', blockIndex++);
          }
        }

        // Reset state for each attempt (in case a previous stream partially filled these)
        currentText = '';
        currentToolUses = [];
        currentThinking = '';
        stopReason = null;
        activeBlockType = null;
        activeToolIndex = -1;
        inputJsonBuf = '';
        currentBlockIndex = -1;

        const response = await client.messages.create({
          model,
          max_tokens: 8192,
          ...samplingParams(model, { temperature: 0.2 }),
          system: systemPrompt,
          messages: workingMessages,
          tools: allTools,
          stream: true,
        });

        for await (const event of response) {
          switch (event.type) {
            case 'content_block_start': {
              const block = event.content_block;
              activeBlockType = block.type;
              if (block.type === 'text') {
                currentBlockIndex = blockIndex++;
              } else if (block.type === 'tool_use') {
                currentBlockIndex = blockIndex++;
                activeToolIndex = currentToolUses.length;
                currentToolUses.push({
                  id: block.id,
                  name: block.name,
                  input: {},
                  _inputJson: '',
                  _blockIndex: currentBlockIndex,
                });
                inputJsonBuf = '';
              }
              break;
            }

            case 'content_block_delta': {
              const delta = event.delta;
              if (delta.type === 'text_delta') {
                currentText += delta.text;
                // Stream text delta immediately with block_index
                onTextDelta(delta.text, currentBlockIndex);
              } else if (delta.type === 'input_json_delta') {
                if (activeToolIndex >= 0) {
                  currentToolUses[activeToolIndex]._inputJson += delta.partial_json;
                }
              } else if (delta.type === 'thinking_delta') {
                currentThinking += delta.thinking;
                if (onThinking) onThinking(delta.thinking);
              }
              break;
            }

            case 'content_block_stop': {
              // Parse accumulated JSON for tool use blocks
              if (activeBlockType === 'tool_use' && activeToolIndex >= 0) {
                const tu = currentToolUses[activeToolIndex];
                try {
                  tu.input = JSON.parse(tu._inputJson || '{}');
                } catch {
                  tu.input = {};
                }
                delete tu._inputJson;
              }
              activeBlockType = null;
              activeToolIndex = -1;
              currentBlockIndex = -1;
              break;
            }

            case 'message_delta': {
              if (event.delta?.stop_reason) {
                stopReason = event.delta.stop_reason;
              }
              if (event.usage) {
                totalInputTokens += event.usage.input_tokens || 0;
                totalOutputTokens += event.usage.output_tokens || 0;
              }
              break;
            }

            case 'message_start': {
              if (event.message?.usage) {
                totalInputTokens += event.message.usage.input_tokens || 0;
                totalOutputTokens += event.message.usage.output_tokens || 0;
              }
              break;
            }
          }
        }

        // Stream completed successfully
        break;
      } catch (apiErr) {
        if (isModelNotFound(apiErr)) {
          logAiError('chat', apiErr, model);
          if (model === PRIMARY_MODEL && BACKUP_MODEL !== PRIMARY_MODEL) {
            model = BACKUP_MODEL;
            console.error(`[Claude] Primary model "${PRIMARY_MODEL}" does not exist — retrying once on "${BACKUP_MODEL}".`);
            continue;
          }
          const fatal = new Error(describeAiError(apiErr, model));
          fatal.friendly = true;
          fatal.status = apiErr.status;
          fatal.cause = apiErr;
          throw fatal;
        }
        const isTransient = apiErr.status === 529 ||
          apiErr.message?.includes('overloaded') || apiErr.message?.includes('Overloaded') ||
          apiErr.status === 429;
        if (isTransient && attempt < maxAttempts - 1) {
          const delay = (attempt < 3 ? (attempt + 1) * 3000 : 2000);
          console.log(`[Claude] Transient error on ${model} (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        logAiError('chat', apiErr, model);
        throw apiErr;
      }
    }

    // No tool calls — this is the final response
    if (stopReason !== 'tool_use' || currentToolUses.length === 0) {
      // Text was already streamed in real-time via content_block_delta
      if (currentText) {
        fullText += currentText;
      }

      // Build assistant content for history
      const assistantContent = [];
      if (currentText) assistantContent.push({ type: 'text', text: currentText });
      if (assistantContent.length > 0) {
        workingMessages.push({ role: 'assistant', content: assistantContent });
      }

      // Emit the final analysis text as a report section (root cause analysis, conclusions)
      const finalText = currentText.trim();
      if (finalText && onReportSection && iterations > 1) {
        onReportSection({
          id: 'section-final',
          narrative: finalText,
          toolCalls: [],
          isFinalAnalysis: true,
        });
      }

      onUsage({ input_tokens: totalInputTokens, output_tokens: totalOutputTokens, model });
      onComplete(fullText, allToolCalls);
      return;
    }

    // We have tool calls — this is an investigation round
    // The text in this response is an interim observation (for the report)
    const interimText = currentText.trim();

    // Text was already streamed in real-time via content_block_delta
    if (interimText) {
      fullText += interimText + '\n\n';
    }

    // Build assistant message for history
    const assistantContent = [];
    if (currentText) assistantContent.push({ type: 'text', text: currentText });
    for (const tu of currentToolUses) {
      assistantContent.push({
        type: 'tool_use',
        id: tu.id,
        name: tu.name,
        input: tu.input,
      });
    }
    workingMessages.push({ role: 'assistant', content: assistantContent });

    // Execute all tool calls in parallel
    const roundToolCalls = [];
    const toolResultBlocks = [];

    // Emit all tool_start events with a small stagger so spinners appear progressively
    for (let ti = 0; ti < currentToolUses.length; ti++) {
      const tu = currentToolUses[ti];
      if (tu.name !== 'think') {
        onToolStart(tu.name, tu.input, tu.id, tu._blockIndex);
        if (ti < currentToolUses.length - 1) {
          await new Promise(r => setTimeout(r, 150)); // stagger starts
        }
      }
    }

    // Execute all tool calls in parallel (starts are already shown)
    const toolPromises = currentToolUses.map(async (tu) => {
      if (tu.name === 'think') {
        if (onThinking) onThinking(tu.input.analysis || '');
        return {
          toolUseId: tu.id,
          name: tu.name,
          args: tu.input,
          result: { acknowledged: true },
          resultStr: JSON.stringify({ acknowledged: true }),
          isThink: true,
        };
      }

      const result = await executeToolFn(tu.name, tu.input);
      const resultStr = trimToolResult(result);

      const tcRecord = {
        id: tu.id,
        type: 'function',
        function: { name: tu.name, arguments: JSON.stringify(tu.input) },
        _result: result,
      };
      allToolCalls.push(tcRecord);

      return {
        toolUseId: tu.id,
        name: tu.name,
        args: tu.input,
        result,
        resultStr,
        isThink: false,
        blockIndex: tu._blockIndex,
      };
    });

    const results = await Promise.all(toolPromises);

    // Emit tool results with a stagger so charts/tables appear one by one
    for (const r of results) {
      if (!r.isThink) {
        onToolResult(r.name, r.result, r.toolUseId, r.blockIndex);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    // Build tool result message for Claude
    const toolResultContent = results.map(r => ({
      type: 'tool_result',
      tool_use_id: r.toolUseId,
      content: r.resultStr,
    }));
    workingMessages.push({ role: 'user', content: toolResultContent });

    // Emit report section with this round's data
    const sectionToolCalls = results
      .filter(r => !r.isThink)
      .map(r => ({
        id: r.toolUseId,
        name: r.name,
        args: r.args,
        result: r.result,
      }));

    if (sectionToolCalls.length > 0 && onReportSection) {
      onReportSection({
        id: 'section-' + iterations,
        narrative: interimText,
        toolCalls: sectionToolCalls,
      });
    }

    // Continue the loop — Claude will see the tool results and continue investigating
  }

  // Hit iteration limit
  onUsage({ input_tokens: totalInputTokens, output_tokens: totalOutputTokens, model });
  onComplete(fullText, allToolCalls);
}
