"use client";

import { useActionState, useState } from "react";
import { addKeepApart, addCheck, addTraining, inviteStaff, markBack, markLeft, saveAdjustments, setMobile, updateHolidaySettings, updatePayrollId, addSupervision, saveSponsorship, type FormState, type InviteState, savePersonalLicence, saveAgency } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function AddCheckForm({ workerId }: { workerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCheck, {});
  const [kind, setKind] = useState("right_to_work");
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Record a check</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Type of check</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          <option value="right_to_work">Right to work</option>
          <option value="dbs">DBS</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date checked</span>
        <input name="checkedOn" type="date" required className={input} />
      </label>
      {kind === "right_to_work" ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Follow-up check due (if permission is time-limited)</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty for British or Irish citizens and settled status.</span>
          <input name="expiresOn" type="date" className={input} />
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">DBS level</span>
            <select name="dbsLevel" defaultValue="enhanced_barred" className={input}>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="enhanced">Enhanced</option>
              <option value="enhanced_barred">Enhanced with barred list</option>
            </select>
          </label>
          <label className="flex items-start gap-2">
            <input name="updateService" type="checkbox" className="mt-1 h-5 w-5" />
            <span>They are on the DBS Update Service, so you can check their certificate online</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Recheck due (optional)</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              A DBS certificate has no end date in law. Many care providers recheck every 3 years, or check the Update Service every year.
            </span>
            <input name="expiresOn" type="date" className={input} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Reference (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Share code or certificate number.</span>
        <input name="reference" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save check"}
      </button>
    </form>
  );
}

export function AddTrainingForm({ workerId, known }: { workerId: string; known: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTraining, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Record training</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Training or qualification</span>
        <input name="name" list="known-training" required placeholder="Food hygiene level 2" className={input} />
        <datalist id="known-training">
          {known.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Achieved on (optional)</span>
        <input name="achievedOn" type="date" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Expires on (optional)</span>
        <input name="expiresOn" type="date" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Licence or certificate number (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">For an SIA licence, the 16-digit number on the front of the card.</span>
        <input name="reference" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save training"}
      </button>
    </form>
  );
}

export function HolidaySettingsForm({
  workerId,
  employmentStart,
  daysPerWeek,
  irregularHours,
}: {
  workerId: string;
  employmentStart: string | null;
  daysPerWeek: number;
  irregularHours: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateHolidaySettings, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Holiday settings</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Start date (optional)</span>
        <input name="employmentStart" type="date" defaultValue={employmentStart ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Usual days worked a week</span>
        <input name="daysPerWeek" type="number" min={0.5} max={7} step={0.5} defaultValue={daysPerWeek} className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input name="irregularHours" type="checkbox" defaultChecked={irregularHours} /> Works irregular hours (holiday counted in hours)
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save holiday settings"}
      </button>
    </form>
  );
}

export function PayrollIdForm({ workerId, payrollId }: { workerId: string; payrollId: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePayrollId, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Payroll ID</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Their employee number in your payroll software, so imported pay lands on the right person.</span>
        <input name="payrollId" defaultValue={payrollId ?? ""} maxLength={40} autoComplete="off" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save payroll ID"}
      </button>
    </form>
  );
}

export function SupervisionForm({ workerId }: { workerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSupervision, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">What was held</span>
        <select name="kind" className={input} defaultValue="supervision">
          <option value="supervision">Supervision</option>
          <option value="appraisal">Appraisal</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date held</span>
        <input name="heldOn" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Next one due (optional)</span>
        <input name="nextDueOn" type="date" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Record it"}
      </button>
    </form>
  );
}

/** mobile is shown formatted, e.g. "07700 900123", or null when none is saved. */
export function InviteForm({ workerId, name, mobile }: { workerId: string; name: string; mobile: string | null }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteStaff, {});
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      {state.link && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={state.link} aria-label="Invitation link" className={`${input} min-w-0 flex-1 font-mono text-sm`} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="rounded-lg border border-zinc-400 px-3 py-2"
            onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {mobile && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="byText" defaultChecked /> Text the link to {mobile}
        </label>
      )}
      <button type="submit" disabled={pending} className={`${button} self-start`}>
        {pending ? "Creating link…" : state.link ? "Create a new link" : `Invite ${name} to log in`}
      </button>
    </form>
  );
}

export function MobileForm({ workerId, mobile }: { workerId: string; mobile: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setMobile, {});
  return (
    <form key={state.values?.mobile ?? ""} action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">UK mobile</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Used to text them their invitation. Leave empty to remove it.</span>
        <input name="mobile" type="tel" autoComplete="off" defaultValue={state.values?.mobile ?? mobile ?? ""} placeholder="07700 900123" className={`${input} max-w-xs`} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2">
        {pending ? "Saving…" : "Save number"}
      </button>
    </form>
  );
}

export function AdjustmentsForm({ workerId, current }: { workerId: string; current: { maxShiftHours?: number; earliestStart?: string; latestFinish?: string; note?: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdjustments, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Longest shift (hours)</span>
          <input name="maxShiftHours" inputMode="decimal" defaultValue={v?.maxShiftHours ?? current.maxShiftHours ?? ""} className={`${input} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Start no earlier than</span>
          <input name="earliestStart" type="time" defaultValue={v?.earliestStart ?? current.earliestStart ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Finish by</span>
          <input name="latestFinish" type="time" defaultValue={v?.latestFinish ?? current.latestFinish ?? ""} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">What was agreed and why (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Only managers and this person can see this. It is never shown on the rota.</span>
        <textarea name="note" rows={3} defaultValue={v?.note ?? current.note ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className={`${button} self-start`}>{pending ? "Saving…" : "Save adjustments"}</button>
    </form>
  );
}

/** Marking someone as having left, or bringing them back. */
export function LeavingForm({ workerId, name, leftOn, today }: { workerId: string; name: string; leftOn: string | null; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(leftOn ? markBack : markLeft, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      {leftOn ? (
        <button type="submit" disabled={pending} className={`${button} self-start`}>
          {name} is back on the team
        </button>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Their last day</span>
            <input name="leftOn" type="date" required defaultValue={today} className={input} />
          </label>
          <button type="submit" disabled={pending} className={`${button} self-start`}>
            Mark {name} as left
          </button>
        </>
      )}
    </form>
  );
}

type SponsorshipValue = { route: string; cosNumber?: string | null; weeklyHours?: number | null; annualSalaryPence?: number | null; startedOn?: string | null };

export function SponsorshipForm({ workerId, current }: { workerId: string; current: SponsorshipValue | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSponsorship, {});
  const [sponsored, setSponsored] = useState(!!current);
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="sponsored" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} className="h-5 w-5" />
        <span className="font-medium">We sponsor this person&apos;s visa</span>
      </label>
      {sponsored && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Visa route</span>
            <select name="route" defaultValue={current?.route ?? "health_and_care"} className={input}>
              <option value="health_and_care">Health and Care Worker</option>
              <option value="skilled_worker">Skilled Worker</option>
              <option value="other">Other sponsored route</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Certificate of sponsorship number (optional)</span>
            <input name="cosNumber" defaultValue={current?.cosNumber ?? ""} maxLength={20} autoComplete="off" className={input} />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Weekly hours</span>
              <input name="weeklyHours" inputMode="decimal" defaultValue={current?.weeklyHours ?? ""} className={`${input} w-28`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Yearly salary (£)</span>
              <input name="salary" inputMode="decimal" defaultValue={current?.annualSalaryPence ? (current.annualSalaryPence / 100).toFixed(2) : ""} className={`${input} w-40`} />
            </label>
          </div>
          <span className="-mt-2 text-sm text-zinc-600 dark:text-zinc-400">As written on their certificate. Pay below this is flagged on the Sponsored workers page.</span>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Sponsored job started on</span>
            <input name="startedOn" type="date" defaultValue={current?.startedOn ?? ""} className={input} />
          </label>
        </>
      )}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save sponsorship"}
      </button>
    </form>
  );
}

/** Keeps this person off overlapping shifts with someone else. Private to managers. */
export function KeepApartForm({ workerId, others }: { workerId: string; others: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addKeepApart, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Keep apart from</span>
        <select name="otherId" required defaultValue="" className={input}>
          <option value="" disabled>Choose a person</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Private note (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">A short reminder for managers, such as a case reference. Keep details of any complaint in your HR records, not here.</span>
        <input name="note" maxLength={200} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Review on (optional)</span>
        <input name="reviewOn" type="date" className={input} />
      </label>
      <button type="submit" disabled={pending} className={`self-start ${button}`}>{pending ? "Saving…" : "Keep apart"}</button>
    </form>
  );
}

export function PersonalLicenceForm({ workerId, current }: { workerId: string; current: { number: string; authority: string; issuedOn?: string } | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePersonalLicence, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Licence number</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave blank if they do not hold one.</span>
        <input name="number" defaultValue={current?.number ?? ""} maxLength={40} autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Issued by (council)</span>
        <input name="authority" defaultValue={current?.authority ?? ""} maxLength={120} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Issued on (optional)</span>
        <input name="issuedOn" type="date" defaultValue={current?.issuedOn ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save personal licence"}
      </button>
    </form>
  );
}

export function AgencyForm({ workerId, current }: { workerId: string; current: { agencyName: string; startedOn: string; role?: string } | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAgency, {});
  const [agency, setAgency] = useState(!!current);
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isAgency" checked={agency} onChange={(e) => setAgency(e.target.checked)} className="h-5 w-5" />
        <span className="font-medium">Supplied by an agency</span>
      </label>
      {agency && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Agency</span>
            <input name="agencyName" defaultValue={current?.agencyName ?? ""} maxLength={120} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Assignment with you started on</span>
            <input name="agencyStartedOn" type="date" defaultValue={current?.startedOn ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Role (optional)</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">If they move to a substantially different role, start a new assignment date.</span>
            <input name="agencyRole" defaultValue={current?.role ?? ""} maxLength={120} className={input} />
          </label>
        </>
      )}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save agency details"}
      </button>
    </form>
  );
}
