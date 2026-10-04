import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { WorkProfileForm } from "./form";

export default async function WorkProfilePage() {
  const { worker, businessName } = await requireStaff();
  const largeText = !!worker.preferences.largeText;
  return (
    <main className={`mx-auto w-full max-w-2xl px-4 py-8 lg:px-8 ${largeText ? "text-lg" : ""}`}>
      <p>
        <Link href="/me" className="underline">Back to my shifts</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">How I work best</h1>
      <p className="mt-2">
        Everyone works differently. This is your space to say, in your own words, what you bring and what helps you at {businessName}.
        Answer as much or as little as you like. Nothing here is required.
      </p>
      <p className="mt-2">
        It stays private to you unless you choose to share it with your managers. If you have agreed changes to your hours or duties, your
        manager records those separately as adjustments.
      </p>
      <WorkProfileForm profile={worker.workProfile} />
    </main>
  );
}
