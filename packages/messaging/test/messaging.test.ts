import { describe, expect, it, vi } from "vitest";
import { tellsChanges, wantsTexts, formatUkMobile, helpAlert, httpSender, inviteText, lateAlert, reminderNotice, reminderText, rotaChangeNotice, normaliseUkMobile, overdueAlert, rotaChangeText, senderFromEnv, SMS_MAX } from "../src";

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
  it("remind people of a shift in one plain sentence", () => {
    expect(reminderText({ business: "Corner Bakery", when: "tomorrow, Tue 6 Oct, 08:00 to 16:00", detail: "Baker", note: "Delivery at 10", link: "L" })).toBe(
      "Reminder from Corner Bakery: your shift tomorrow, Tue 6 Oct, 08:00 to 16:00, Baker. Note: Delivery at 10. Details: L",
    );
  });
  it("say who has not clocked in and for which shift", () => {
    expect(lateAlert({ business: "Corner Bakery", person: "Jo Bell", shift: "08:00 to 16:00", where: "Baker", link: "L" })).toBe(
      "Corner Bakery: Jo Bell has not clocked in for their shift 08:00 to 16:00 (Baker). Please check the shift is covered and they are OK. L",
    );
  });
});

describe("staff texts", () => {
  it("invite says who, why and how long the link works", () => {
    expect(inviteText({ business: "Corner Bakery", link: "https://vicisrota.app/join/abc", days: 7 })).toBe(
      "Corner Bakery has invited you to VicisRota to see your shifts and ask for time off. Set up your login here (works once, for 7 days): https://vicisrota.app/join/abc",
    );
  });
  it("rota changes are listed one per line, with a count when there are many", () => {
    const changes = ["Mon 5 Oct 08:00-14:00", "Tue 6 Oct 08:00-14:00", "Wed 7 Oct 08:00-14:00", "Thu 8 Oct 08:00-14:00"].map((when) => ({ kind: "added" as const, when }));
    const text = rotaChangeText({ business: "Corner Bakery", changes, link: "L" });
    expect(text).toBe("Corner Bakery: your rota has changed.\nNew shift: Mon 5 Oct 08:00-14:00\nNew shift: Tue 6 Oct 08:00-14:00\nNew shift: Wed 7 Oct 08:00-14:00\nand 1 more.\nSee your shifts: L");
    expect(rotaChangeText({ business: "B", changes: [{ kind: "cancelled", when: "Fri 9 Oct 18:00-23:00" }], link: "L" })).toContain("Cancelled: Fri 9 Oct 18:00-23:00");
    expect(rotaChangeText({ business: "B", changes: [{ kind: "changed", when: "Sat 10 Oct 09:00-15:00" }], link: "L" })).toContain("Changed, now: Sat 10 Oct 09:00-15:00");
    expect(rotaChangeText({ business: "B".repeat(400), changes, link: "L" }).length).toBeLessThanOrEqual(SMS_MAX);
  });
});

describe("app notifications", () => {
  it("lists rota changes without a link, since tapping opens the shifts", () => {
    const changes = ["Mon 5 Oct", "Tue 6 Oct", "Wed 7 Oct", "Thu 8 Oct"].map((d) => ({ kind: "added" as const, when: `${d} 08:00-14:00` }));
    expect(rotaChangeNotice({ business: "Corner Bakery", changes })).toEqual({
      title: "Corner Bakery: your rota has changed",
      body: "New shift: Mon 5 Oct 08:00-14:00\nNew shift: Tue 6 Oct 08:00-14:00\nNew shift: Wed 7 Oct 08:00-14:00\nand 1 more.",
    });
  });
  it("words a reminder like the text, with the note", () => {
    expect(reminderNotice({ business: "B", when: "today, 09:00 to 17:00", detail: "Chef at Kitchen", note: "Bring whites" })).toEqual({
      title: "B: shift reminder",
      body: "Your shift today, 09:00 to 17:00, Chef at Kitchen. Note: Bring whites.",
    });
  });
});

describe("who gets texts", () => {
  it("rota changes are on unless turned off", () => {
    expect(tellsChanges({})).toBe(true);
    expect(tellsChanges({ textChanges: false })).toBe(false);
  });
  it("texts only go to people who chose them and gave a number", () => {
    expect(wantsTexts({ byText: true }, "+447700900123")).toBe(true);
    expect(wantsTexts({ byText: true }, null)).toBe(false);
    expect(wantsTexts({ byText: false, textChanges: true }, "+447700900123")).toBe(false);
  });
  it("people who set up texts before app notifications keep getting them", () => {
    expect(wantsTexts({ remindEvening: true }, "+447700900123")).toBe(true);
    expect(wantsTexts({ remindBeforeMinutes: 60 }, "+447700900123")).toBe(true);
    // A number given only for the invitation does not mean they wanted texts.
    expect(wantsTexts({}, "+447700900123")).toBe(false);
  });
});
