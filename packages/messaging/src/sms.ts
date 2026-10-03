export interface SmsResult {
  ok: boolean;
  /** The provider's reference for the message, when it gives one. */
  providerRef?: string;
  error?: string;
}

export interface SmsSender {
  /** Which provider this is, for the message log. */
  name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

/**
 * Works with most bulk SMS providers' HTTP APIs, set entirely by configuration, so changing provider
 * needs no code change. Placeholders in the URL and body:
 *   {{to}}        +447700900123
 *   {{to_digits}} 447700900123 (what many UK providers expect)
 *   {{body}}      the message text
 *   {{from}}      the sender name or number
 * Values are encoded to suit where they appear: URL-encoded in the URL and in form bodies, JSON-escaped in JSON bodies.
 */
export interface HttpSmsConfig {
  url: string;
  method?: "POST" | "GET";
  headers?: Record<string, string>;
  /** "json" or "form". Ignored for GET. */
  bodyType?: "json" | "form";
  bodyTemplate?: string;
  from: string;
  /** If set, the response body must match this for the message to count as sent. */
  successPattern?: string;
  /** Pulls the provider's message reference from the response body (first capture group). */
  refPattern?: string;
}

const fill = (template: string, values: Record<string, string>, encode: (v: string) => string) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? encode(values[key]!) : match));

const jsonEscape = (v: string) => JSON.stringify(v).slice(1, -1);

export const httpSender = (config: HttpSmsConfig, fetchImpl: typeof fetch = fetch): SmsSender => ({
  name: "http",
  async send(to, body) {
    const values = { to, to_digits: to.replace(/^\+/, ""), body, from: config.from };
    const method = config.method ?? "POST";
    const url = fill(config.url, values, encodeURIComponent);
    const headers: Record<string, string> = { ...config.headers };
    let requestBody: string | undefined;
    if (method === "POST" && config.bodyTemplate) {
      const json = (config.bodyType ?? "json") === "json";
      requestBody = fill(config.bodyTemplate, values, json ? jsonEscape : encodeURIComponent);
      headers["Content-Type"] ??= json ? "application/json" : "application/x-www-form-urlencoded";
    }
    try {
      const res = await fetchImpl(url, { method, headers, ...(requestBody === undefined ? {} : { body: requestBody }), signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      if (config.successPattern && !new RegExp(config.successPattern).test(text)) return { ok: false, error: `Unexpected reply: ${text.slice(0, 200)}` };
      const ref = config.refPattern ? new RegExp(config.refPattern).exec(text)?.[1] : undefined;
      return ref ? { ok: true, providerRef: ref } : { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
});

/** For development and before a provider is set up: nothing is sent, the message is only logged. */
export const logSender = (log: (line: string) => void = console.log): SmsSender => ({
  name: "log",
  async send(to, body) {
    log(JSON.stringify({ level: "info", message: "sms not sent (no provider configured)", to: `${to.slice(0, 6)}...`, length: body.length }));
    return { ok: true, providerRef: "not-sent" };
  },
});

/** Picks the sender from environment variables. See .env.example for the full list. */
export const senderFromEnv = (env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): SmsSender => {
  if (env.SMS_PROVIDER !== "http") return logSender();
  if (!env.SMS_HTTP_URL || !env.SMS_FROM) throw new Error("SMS_PROVIDER=http needs SMS_HTTP_URL and SMS_FROM");
  const config: HttpSmsConfig = {
    url: env.SMS_HTTP_URL,
    from: env.SMS_FROM,
    method: env.SMS_HTTP_METHOD === "GET" ? "GET" : "POST",
    bodyType: env.SMS_HTTP_BODY_TYPE === "form" ? "form" : "json",
    headers: env.SMS_HTTP_HEADERS ? (JSON.parse(env.SMS_HTTP_HEADERS) as Record<string, string>) : {},
    ...(env.SMS_HTTP_BODY ? { bodyTemplate: env.SMS_HTTP_BODY } : {}),
    ...(env.SMS_HTTP_SUCCESS ? { successPattern: env.SMS_HTTP_SUCCESS } : {}),
    ...(env.SMS_HTTP_REF ? { refPattern: env.SMS_HTTP_REF } : {}),
  };
  return httpSender(config, fetchImpl);
};
