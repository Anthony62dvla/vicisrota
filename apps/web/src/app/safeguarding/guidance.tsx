/** Where to go when someone is in danger, or when a concern cannot be raised inside the business. */
import { en, type Messages } from "@/lib/i18n/en";

export function OutsideHelp({ sector, t = en.concern }: { sector: string; t?: Messages["concern"] }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p>
        <strong>{t.danger}</strong> {t.thenRecord}
      </p>
      <p>{t.outside}</p>
      <ul className="ml-5 list-disc">
        <li>{t.council}</li>
        <li>{t.police}</li>
        {sector === "care" && <li>{t.cqc}</li>}
        <li>{t.hse}</li>
        <li>{t.nspcc}</li>
        <li>{t.protect}</li>
      </ul>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t.law}
      </p>
    </div>
  );
}
