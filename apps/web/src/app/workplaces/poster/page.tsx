import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { posterQr } from "@/lib/qr-clock";
import { PrintButton } from "./print-button";

/**
 * A poster to put up where there is no clock-in tablet. Scanning it opens the person's own clock-in page.
 * A printed code can be photographed, so it proves nothing on its own: the phone's location check does that.
 */
export default async function PosterPage({ searchParams }: PageProps<"/workplaces/poster">) {
  const { organisationId, businessName } = await requireManager();
  const id = (await searchParams).l;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [place] = await withOrganisation(db, organisationId, (tx) => tx.select().from(schema.location).where(eq(schema.location.id, id)));
  if (!place) notFound();
  const svg = await posterQr();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 text-center">
      <div className="flex w-full justify-between gap-3 print:hidden">
        <Link href="/workplaces" className="underline">Back to Workplaces</Link>
        <PrintButton />
      </div>
      {place.latitude === null && (
        <p role="alert" className="mt-4 rounded-lg border-l-4 border-amber-500 bg-warn-soft p-3 text-left print:hidden">
          {place.name} has no location set, so a phone that scans this poster is not checked for being at work. Set the location on the Workplaces
          page and turn on location checks, or use a clock-in tablet, whose code changes every 30 seconds.
        </p>
      )}
      <p className="mt-10 text-2xl text-zinc-600">{businessName}</p>
      <h1 className="mt-1 text-5xl font-bold">Clock in here</h1>
      <div
        role="img"
        aria-label="QR code that opens VicisRota clock-in"
        className="mt-8 h-80 w-80 rounded-xl border-4 border-[#0e7490] bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <ol className="mt-8 flex max-w-md flex-col gap-2 text-left text-xl">
        <li>1. Open your phone&rsquo;s camera and point it at the code.</li>
        <li>2. Tap the link, and sign in if asked.</li>
        <li>3. Tap Clock in. Your phone checks you are at {place.name}.</li>
      </ol>
    </main>
  );
}
