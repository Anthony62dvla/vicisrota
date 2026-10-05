import { cookies } from "next/headers";
import Link from "next/link";
import { DISPLAY_COOKIE, DISPLAY_OPTIONS, parseDisplay } from "@/lib/display";
import { LANGUAGES, localeOf } from "@vicisrota/messaging";
import { getLang, getMessages } from "@/lib/i18n/server";
import { saveDisplay, saveLanguage } from "./actions";

export default async function DisplayPage({ searchParams }: PageProps<"/display">) {
  const params = await searchParams;
  const back = typeof params.back === "string" && params.back.startsWith("/") && !params.back.startsWith("//") ? params.back : null;
  const current = new Set(parseDisplay((await cookies()).get(DISPLAY_COOKIE)?.value));
  const lang = await getLang();
  const t = (await getMessages()).language;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
      {back && (
        <p>
          <Link href={back} className="underline">Go back</Link>
        </p>
      )}
      <h1 className="mt-2 text-2xl font-semibold">Display and language</h1>
      <p className="mt-2">
        Choose your language and how VicisRota looks for you. The look settings are saved on this phone or computer only, so you can set each device the way
        that suits you. Your workplace cannot see them.
      </p>
      <section lang={localeOf(lang)} className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700" aria-labelledby="language-heading">
        <h2 id="language-heading" className="text-lg font-semibold">{t.heading}</h2>
        <p className="mt-1">{t.hint}</p>
        {params.saved === "language" && (
          <p role="status" className="mt-3 rounded-lg border border-green-600 p-3">{t.saved}</p>
        )}
        <form action={saveLanguage} className="mt-3 flex flex-col gap-2">
          {back && <input type="hidden" name="back" value={back} />}
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t.heading}</legend>
            {LANGUAGES.map((l) => (
              <label key={l.code} lang={l.locale} className="flex items-center gap-3">
                <input type="radio" name="language" value={l.code} defaultChecked={l.code === lang} className="size-5" />
                <span>
                  <span className="font-medium">{l.own}</span>
                  {l.own !== l.name && <span className="text-muted" lang="en-GB"> ({l.name})</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">{t.save}</button>
        </form>
        {lang !== "en" && <p className="mt-3 text-sm text-muted">{t.review}</p>}
      </section>

      {params.saved === "1" && (
        <p role="status" className="mt-4 rounded-lg border border-green-600 p-3">Saved. Every page now looks like this on this device.</p>
      )}
      <form action={saveDisplay} className="mt-6 flex flex-col gap-4">
        {back && <input type="hidden" name="back" value={back} />}
        {DISPLAY_OPTIONS.map((o) => (
          <label key={o.key} className="flex items-start gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <input type="checkbox" name="display" value={o.key} defaultChecked={current.has(o.key)} className="mt-1 size-5" />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">{o.hint}</span>
            </span>
          </label>
        ))}
        <button type="submit" className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">Save</button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Your phone or computer&apos;s own settings for dark mode and reduced motion are followed too.
      </p>
    </main>
  );
}
