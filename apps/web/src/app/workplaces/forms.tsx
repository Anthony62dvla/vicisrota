"use client";

import { useActionState, useState } from "react";
import { addWorkplace, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function AddWorkplaceForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addWorkplace, {});
  const [coordinates, setCoordinates] = useState("");
  const [finding, setFinding] = useState<string | null>(null);
  const useHere = () => {
    if (!("geolocation" in navigator)) return setFinding("This device cannot share its location. Paste a map link instead.");
    setFinding("Finding where you are…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoordinates(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);
        setFinding(`Found, to within about ${Math.round(p.coords.accuracy)} metres.`);
      },
      () => setFinding("Location was not shared. Paste a map link instead."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name</span>
        <input name="name" required placeholder="Main shop" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Address (optional)</span>
        <input name="address" className={input} />
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="coordinates" className="font-medium">Where it is (optional)</label>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Needed for location checks. Tap the button while you are there, or paste a Google Maps link or &ldquo;latitude, longitude&rdquo;.
        </span>
        <div className="flex flex-wrap gap-2">
          <input id="coordinates" name="coordinates" value={coordinates} onChange={(e) => setCoordinates(e.target.value)} className={`${input} flex-1`} />
          <button type="button" onClick={useHere} className="rounded-lg border border-zinc-400 px-3 py-2">Use where I am now</button>
        </div>
        {finding && <p className="text-sm" role="status">{finding}</p>}
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">How close counts as at work</span>
        <select name="radius" defaultValue="150" className={input}>
          {[50, 100, 150, 250, 500].map((m) => (
            <option key={m} value={m}>Within {m} metres</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Adding…" : "Add workplace"}
      </button>
    </form>
  );
}
