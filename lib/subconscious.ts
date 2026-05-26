import { createOpenAI } from "@ai-sdk/openai";

export const SUBCONSCIOUS_MODEL_ID = "subconscious/tim-qwen3.6-27b";

const SUBC_BASE_URL = "https://api.subconscious.dev/v1";
const FALLBACK_ERROR_PATTERN = /quota|limit|billing|exhausted|credit|payment/i;

let activeKeyIndex = 0;
let warnedAboutSingleKey = false;
let loggedFailover = false;

function getSubconsciousApiKeys() {
  return [
    process.env.SUBCONSCIOUS_API_KEY,
    process.env.SUBCONSCIOUS_API_KEY_2,
  ].filter((key): key is string => Boolean(key?.trim()));
}

/**
 * Subconscious defaults thinking ON. TIM gates it via
 * `chat_template_kwargs.enable_thinking` on the wire — inject it in a fetch
 * override because the OpenAI SDK doesn't expose that param directly.
 */
function injectSubconsciousRequestOptions(
  init: RequestInit | undefined,
  enableThinking: boolean,
): RequestInit | undefined {
  if (!init?.body) {
    return init;
  }

  let bodyText: string | undefined;
  if (typeof init.body === "string") {
    bodyText = init.body;
  } else if (init.body instanceof Uint8Array) {
    bodyText = new TextDecoder().decode(init.body);
  }

  if (!bodyText) {
    return init;
  }

  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const existingKwargs =
      (parsed.chat_template_kwargs as Record<string, unknown> | undefined) ?? {};
    parsed.chat_template_kwargs = {
      ...existingKwargs,
      enable_thinking: enableThinking,
    };
    parsed.stream_options = { include_usage: true };
    return { ...init, body: JSON.stringify(parsed) };
  } catch {
    return init;
  }
}

function withAuthorization(init: RequestInit | undefined, apiKey: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);

  return {
    ...init,
    headers,
  };
}

function rebuildResponse(response: Response, body: BodyInit | null) {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function classifyFailoverEligibility(response: Response) {
  if (response.ok) {
    return { eligible: false, response };
  }

  if (response.status === 429 || response.status === 402) {
    return { eligible: true, response };
  }

  if (response.status !== 403) {
    return { eligible: false, response };
  }

  const bodyText = await response.text();
  return {
    eligible: FALLBACK_ERROR_PATTERN.test(bodyText),
    response: rebuildResponse(response, bodyText),
  };
}

async function fetchWithSubconsciousFailover(
  url: RequestInfo | URL,
  init: RequestInit | undefined,
) {
  const keys = getSubconsciousApiKeys();

  if (keys.length === 0) {
    return fetch(url, init);
  }

  const startingIndex = Math.min(activeKeyIndex, keys.length - 1);
  const firstResponse = await fetch(
    url,
    withAuthorization(init, keys[startingIndex]),
  );
  const decision = await classifyFailoverEligibility(firstResponse);
  const nextIndex = startingIndex + 1;

  if (!decision.eligible || nextIndex >= keys.length) {
    return decision.response;
  }

  activeKeyIndex = nextIndex;

  if (!loggedFailover) {
    console.warn(
      `Subconscious key ${startingIndex + 1} exhausted/rate-limited - switching to key ${nextIndex + 1}`,
    );
    loggedFailover = true;
  }

  return fetch(url, withAuthorization(init, keys[nextIndex]));
}

function createSubconsciousProvider(enableThinking: boolean) {
  const keys = getSubconsciousApiKeys();

  return createOpenAI({
    baseURL: SUBC_BASE_URL,
    apiKey: keys[0] ?? "missing-subconscious-api-key",
    fetch: async (url, init) => {
      return fetchWithSubconsciousFailover(
        url,
        injectSubconsciousRequestOptions(init, enableThinking),
      );
    },
  });
}

/** Thinking off by default — faster replies, no reasoning preamble. */
const subconscious = createSubconsciousProvider(false);

/** Chat completions API — Subconscious does not support /v1/responses. */
export const subconsciousModel = subconscious.chat(SUBCONSCIOUS_MODEL_ID);

export function requireSubconsciousApiKeys() {
  const apiKeys = getSubconsciousApiKeys();

  if (apiKeys.length === 0) {
    throw new Error(
      "Missing SUBCONSCIOUS_API_KEY or SUBCONSCIOUS_API_KEY_2. Get a key at https://www.subconscious.dev/platform",
    );
  }

  if (apiKeys.length === 1 && !warnedAboutSingleKey) {
    console.warn(
      "Only one Subconscious API key is configured. Add SUBCONSCIOUS_API_KEY_2 to enable automatic failover.",
    );
    warnedAboutSingleKey = true;
  }

  return apiKeys;
}

export function requireSubconsciousApiKey() {
  return requireSubconsciousApiKeys()[0];
}
