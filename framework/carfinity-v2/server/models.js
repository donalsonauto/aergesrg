// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
/**
 * Central Claude model configuration.
 *
 * Dated model IDs age out. `claude-sonnet-4-20250514` was retired by Anthropic
 * in June 2026, and from then on every chat message and every analyst run came
 * back as a raw 404 `not_found_error` blob for about six weeks before anyone
 * noticed. Model IDs live here now, overridable by env, so the next retirement
 * is one line in server/.env plus a restart rather than an edit across a dozen
 * files.
 *
 * Optional overrides in server/.env:
 *   ANTHROPIC_CHAT_MODEL      conversational chat + KPI comment analysis
 *   ANTHROPIC_ANALYST_MODEL   the scheduled/triggered intelligence analysts
 *   ANTHROPIC_FALLBACK_MODEL  used when the chat model is unavailable
 *   ANTHROPIC_CHEAP_MODEL     background jobs (daily pulse, traction digest)
 */

const fromEnv = (name, fallback) => (process.env[name] || '').trim() || fallback;

export const CHAT_MODEL = fromEnv('ANTHROPIC_CHAT_MODEL', 'claude-sonnet-5');
export const ANALYST_MODEL = fromEnv('ANTHROPIC_ANALYST_MODEL', 'claude-sonnet-5');
export const FALLBACK_MODEL = fromEnv('ANTHROPIC_FALLBACK_MODEL', 'claude-haiku-4-5');
export const CHEAP_MODEL = fromEnv('ANTHROPIC_CHEAP_MODEL', 'claude-haiku-4-5');

/**
 * The Claude 5 family and Opus 4.7+ reject temperature / top_p / top_k with a
 * 400. Haiku 4.5 and older still accept them. Send sampling params only where
 * they are legal, so swapping the model never turns a 404 into a 400.
 */
const REJECTS_SAMPLING = [
  /^claude-(opus|sonnet|fable|mythos)-5/,
  /^claude-opus-4-[78]/,
];

export function supportsSampling(model = '') {
  return !REJECTS_SAMPLING.some((re) => re.test(model));
}

export function samplingParams(model, params) {
  return supportsSampling(model) ? params : {};
}

/** True when Anthropic says the model ID does not exist (retired or typo). */
export function isModelNotFound(err) {
  const msg = err?.message || '';
  return err?.status === 404 || msg.includes('not_found_error');
}

/**
 * Turn an Anthropic SDK error into a sentence a person can read. The raw
 * `err.message` is a JSON blob, and it used to be piped straight into the chat
 * window.
 */
export function describeAiError(err, model) {
  if (err?.friendly) return err.message;

  if (isModelNotFound(err)) {
    return `The AI model configured for this service ("${model}") is no longer available from Anthropic. ` +
      `Set ANTHROPIC_CHAT_MODEL / ANTHROPIC_ANALYST_MODEL in server/.env to a current model and restart the API.`;
  }
  if (err?.status === 401 || err?.status === 403) {
    return 'The AI service rejected our credentials. The Anthropic API key needs to be checked.';
  }
  if (err?.status === 429) {
    return 'The AI service is rate limiting us right now. Please try again in a minute.';
  }
  if (err?.status === 529 || /overloaded/i.test(err?.message || '')) {
    return 'The AI service is temporarily overloaded. Please try again in a moment.';
  }
  if (err?.status === 400) {
    return `The AI service rejected the request (400). This usually means a request parameter is not valid for "${model}". Details: ${err?.message || 'none'}`;
  }
  return `The AI service returned an error${err?.status ? ` (${err.status})` : ''}. Details: ${err?.message || err}`;
}

/**
 * Log loudly. A dead model must never be a one-line info message buried in a
 * retry loop, because that is exactly how this went unnoticed for six weeks.
 */
export function logAiError(scope, err, model) {
  const tag = isModelNotFound(err) ? 'MODEL NOT FOUND' : `HTTP ${err?.status || '?'}`;
  console.error(`[AI][${scope}] ${tag} model=${model} :: ${err?.message || err}`);
  if (isModelNotFound(err)) {
    console.error(
      `[AI][${scope}] *** "${model}" does not exist at Anthropic. Chat and analysts stay broken ` +
      `until this is fixed. Set the model in server/.env (ANTHROPIC_CHAT_MODEL / ANTHROPIC_ANALYST_MODEL) ` +
      `and restart the API. ***`
    );
  }
}
