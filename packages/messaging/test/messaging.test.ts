import { describe, expect, it, vi } from "vitest";
import { formatUkMobile, helpAlert, httpSender, normaliseUkMobile, overdueAlert, senderFromEnv, SMS_MAX } from "../src";

describe("UK mobile numbers", () => {
  it("accepts common formats", () => {
    for (const n of ["07700 900123", "07700900123", "+44 7700 900123", "0044 7700-900123", "447700900123", "(07700) 900 123"]) {
      expect(normaliseUkMobile(n)).toBe("+447700900123");
    }
  });
  it("refuses landlines, short numbers and other countries", () => {
    for (const n of ["020 7946 0000", "0770090012", "+353 85 123 4567", "07700 9001234", "call me"]) expect(normaliseUkMobile(n)).toBeNull();
  });
  it("formats for display", () => expect(formatUkMobile("+447700900123")).toBe("07700 900123"));
});

const ok = (body = "OK") => vi.fn(async () => new Response(body, { status: 200 }));

describe("HTTP SMS sender", () => {
  it("fills a JSON body, escaping the message safely", async () => {
    const f = ok('{"id":"abc123"}');
    const s = httpSender({ url: "https://sms.example/send", from: "VicisRota", bodyTemplate: '{"to":"{{to_digits}}","text":"{{body}}","from":"{{from}}"}', refPattern: '"id":"(\\w+)"' }, f);
    const r = await s.send("+447700900123", 'He said "help"\nnow');
    expect(r).toEqual({ ok: true, providerRef: "abc123" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sms.example/send");
    expect(JSON.parse(init.body as string)).toEqual({ to: "447700900123", text: 'He said "help"\nnow', from: "VicisRota" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
  it("URL-encodes form bodies and GET URLs", async () => {
    const f = ok();
    await httpSender({ url: "https://sms.example/send", from: "Shop", bodyType: "form", bodyTemplate: "to={{to}}&msg={{body}}" }, f).send("+447700900123", "a&b=c");
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe("to=%2B447700900123&msg=a%26b%3Dc");
    const g = ok();
    await httpSender({ url: "https://sms.example/send?to={{to_digits}}&m={{body}}", from: "x", method: "GET" }, g).send("+447700900123", "hi there");
    expect((g.mock.calls[0] as unknown as [string])[0]).toBe("https://sms.example/send?to=447700900123&m=hi%20there");
  });
  it("reports failures instead of throwing", async () => {
    const bad = vi.fn(async () => new Response("Invalid key", { status: 401 }));
    expect(await httpSender({ url: "https://sms.example", from: "x" }, bad).send("+447700900123", "x")).toEqual({ ok: false, error: "HTTP 401: Invalid key" });
    const odd = ok("ERROR: no credit");
    expect((await httpSender({ url: "https://sms.example", from: "x", successPattern: "^OK" }, odd).send("+447700900123", "x")).ok).toBe(false);
    const down = vi.fn(async () => { throw new Error("network down"); });
    expect(await httpSender({ url: "https://sms.example", from: "x" }, down).send("+447700900123", "x")).toEqual({ ok: false, error: "network down" });
  });
  it("sends nothing unless a provider is configured", async () => {
    expect(senderFromEnv({}).name).toBe("log");
    expect(() => senderFromEnv({ SMS_PROVIDER: "http" })).toThrow(/SMS_HTTP_URL/);
  });
});

describe("alert texts", () => {
  it("keep to two SMS segments and plain characters", () => {
    const text = helpAlert({ business: "Night Watch Ltd", person: "Sam Okoro", at: "23:03", note: "“Man refusing to leave” — ".repeat(20), link: "https://vicisrota.app/lone-working" });
    expect(text.length).toBeLessThanOrEqual(SMS_MAX);
    expect(text).not.toMatch(/[\u201C\u201D\u2014\u2026]/);
    expect(text).toMatch(/^URGENT Night Watch Ltd: Sam Okoro asked for help at 23:03/);
  });
  it("say what was missed and what to do", () => {
    expect(overdueAlert({ business: "Oak House", person: "Priya", what: "has not checked in at the start of their shift", due: "09:00", where: "Edith Jones, AB1 2CD", link: "L" })).toBe(
      "Oak House: Priya has not checked in at the start of their shift (due 09:00), Edith Jones, AB1 2CD. Please check they are safe. If you cannot reach them and are worried, call 999. L",
    );
  });
});
