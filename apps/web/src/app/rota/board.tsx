"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import type { RoleColour } from "@/lib/role-labels";
import { cancelShift, moveShift, saveShift, type FormState } from "./actions";
import { RoleBadge } from "../role-badge";

export type BoardShift = {
  id: string;
  workerId: string | null;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  roleId: string | null;
  clientId: string | null;
  clientName: string | null;
  travelMinutes: number;
  note: string | null;
  loneWorking: boolean;
  checkInMinutes: number;
  requires: string[];
  status: "draft" | "published";
  coverRequested: boolean;
  requested: boolean;
  /** Part of a split shift, for example part 1 of 2. */
  split: { part: number; of: number } | null;
  problems: { severity: "block" | "warn"; message: string }[];
  /** Open shifts only: everyone, best fit first. */
  candidates?: { workerId: string; name: string; hours: number; blocks: string[]; warnings: string[] }[];
};

export type BoardWorker = { id: string; name: string; summary: string | null; roleIds: string[] };

type Props = {
  days: { date: string; label: string; long: string; weekday: number }[];
  workers: BoardWorker[];
  shifts: BoardShift[];
  leave: { workerId: string; date: string; label: string; requested: boolean }[];
  unavailable: { workerId: string; weekday: number; from: string; to: string }[];
  roles: { id: string; name: string; colour: RoleColour }[];
  training: { id: string; name: string }[];
  /** Care providers only: clients a shift can be a visit to. */
  clients?: { id: string; name: string }[];
  usualTimes: { start: string; end: string }[];
};

/** A pale fill in the role's colour, so a week of shifts can be read by role at a glance. The badge names the role too. */
const ROLE_CARD: Record<RoleColour, string> = {
  teal: "bg-teal-50 dark:bg-teal-950",
  blue: "bg-blue-50 dark:bg-blue-950",
  purple: "bg-purple-50 dark:bg-purple-950",
  pink: "bg-pink-50 dark:bg-pink-950",
  orange: "bg-orange-50 dark:bg-orange-950",
  green: "bg-green-50 dark:bg-green-950",
  grey: "bg-zinc-50 dark:bg-zinc-900",
};

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";
const quietButton = "rounded-lg border border-zinc-400 px-4 py-2 hover:bg-brand-soft disabled:opacity-60";

type Open = { mode: "add"; workerId: string | null; date: string } | { mode: "edit"; shiftId: string } | null;

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 bg-surface p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 bg-surface p-3">{state.ok}</p>;
  return null;
}

const unavailableText = (u: { from: string; to: string }) => (u.from === "00:00" && u.to === "24:00" ? "Can't work today" : `Can't work ${u.from}–${u.to === "24:00" ? "midnight" : u.to}`);

export function RotaBoard(props: Props) {
  const { days, workers, shifts, leave, unavailable, roles } = props;
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState<FormState>({});
  const [roleFilter, setRoleFilter] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, startMove] = useTransition();
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const nameById = new Map(workers.map((w) => [w.id, w.name]));

  const shown = (s: BoardShift) => !roleFilter || s.roleId === roleFilter;
  const rows = roleFilter ? workers.filter((w) => w.roleIds.includes(roleFilter) || shifts.some((s) => s.workerId === w.id && s.roleId === roleFilter)) : workers;

  const move = (shiftId: string, workerId: string | null, date: string) => {
    const form = new FormData();
    form.set("shiftId", shiftId);
    form.set("workerId", workerId ?? "");
    form.set("date", date);
    startMove(async () => setMessage(await moveShift({}, form)));
  };

  const dropProps = (workerId: string | null, date: string) => {
    const key = `${workerId ?? "open"}|${date}`;
    return {
      onDragOver: (e: DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (over !== key) setOver(key);
      },
      onDragLeave: () => setOver((k) => (k === key ? null : k)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        setOver(null);
        setDragging(null);
        if (id) move(id, workerId, date);
      },
      className: `border-b border-zinc-200 p-1.5 align-top dark:border-zinc-800 ${over === key ? "bg-brand-soft outline-2 outline-dashed outline-brand" : ""}`,
    };
  };

  const card = (s: BoardShift) => {
    const role = s.roleId ? roleById.get(s.roleId) : undefined;
    const blocks = s.problems.filter((p) => p.severity === "block").length;
    const warns = s.problems.length - blocks;
    return (
      <button
        key={s.id}
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", s.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(s.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        onClick={() => setOpen({ mode: "edit", shiftId: s.id })}
        aria-label={`${s.start} to ${s.end}${s.split ? `, split shift part ${s.split.part} of ${s.split.of}` : ""}${role ? `, ${role.name}` : ""}${s.workerId ? `, ${nameById.get(s.workerId) ?? ""}` : ", open shift"}. ${s.status === "published" ? "Published" : "Draft"}.${s.problems.length ? ` ${s.problems.length} to look at.` : ""} Edit or move.`}
        className={`mb-1.5 block w-full cursor-grab rounded-lg border-2 p-1.5 text-left text-sm shadow-sm hover:border-brand active:cursor-grabbing ${
          role ? ROLE_CARD[role.colour] : "bg-surface"
        } ${s.status === "draft" ? "border-dashed" : ""} ${blocks ? "border-red-600" : warns ? "border-amber-500" : s.status === "draft" ? "border-zinc-400" : "border-zinc-300 dark:border-zinc-600"} ${
          dragging === s.id ? "opacity-50" : ""
        }`}
      >
        <span className="block whitespace-nowrap text-[13px] font-semibold tabular-nums">
          {s.start}–{s.end}
        </span>
        {s.split && (
          <span className="mt-0.5 inline-block rounded-full border border-zinc-400 px-1.5 text-[11px] font-medium">
            Split {s.split.part} of {s.split.of}
          </span>
        )}
        {role && <span className="block truncate text-xs font-medium">{role.name}</span>}
        {s.clientName && <span className="block truncate text-xs font-medium">{s.clientName}</span>}
        <span className="block text-xs text-zinc-600 dark:text-zinc-400">
          {s.status === "published" ? (s.workerId ? "Published" : "Open to staff") : "Draft"}
          {s.coverRequested && " · cover asked"}
          {s.requested && " · requested"}
          {s.loneWorking && " · alone"}
        </span>
        {s.problems.length > 0 && (
          <span className={`mt-1 block text-xs font-semibold ${blocks ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300"}`}>
            {blocks ? `${blocks} to fix` : `${warns} to check`}
          </span>
        )}
      </button>
    );
  };

  const addButton = (workerId: string | null, date: string, who: string) => (
    <button
      type="button"
      onClick={() => setOpen({ mode: "add", workerId, date })}
      aria-label={`Add a shift for ${who} on ${days.find((d) => d.date === date)?.long}`}
      className="block w-full rounded-lg border border-dashed border-transparent px-1 py-1 text-left text-xs text-zinc-500 hover:border-zinc-400 hover:bg-brand-soft hover:text-heading focus-visible:border-zinc-400"
    >
      + Add
    </button>
  );

  const editing = open?.mode === "edit" ? shifts.find((s) => s.id === open.shiftId) : undefined;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Choose <span className="font-medium">+ Add</span> in any square to add a shift for that person and day. Choose a shift to change it, or drag it to another
          person or day. Every change is checked against the law straight away.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {roles.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Show</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={input}>
                <option value="">All job roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setOpen({ mode: "add", workerId: null, date: days[0]!.date })} className={button}>
            Add a shift
          </button>
        </div>
      </div>

      <div className="mt-3" aria-live="polite">
        {moving ? <p role="status" className="rounded-lg border border-zinc-300 bg-surface p-3">Moving the shift and checking it…</p> : <Message state={message} />}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th className="w-40 border-b border-zinc-300 p-2 dark:border-zinc-700">Staff</th>
              {days.map((d) => (
                <th key={d.date} className="border-b border-zinc-300 p-2 dark:border-zinc-700">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <th scope="row" className="border-b border-zinc-200 bg-zinc-50 p-2 font-medium dark:border-zinc-800 dark:bg-zinc-900">
                Open shifts
                <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">Staff can ask to pick these up</span>
              </th>
              {days.map((d) => (
                <td key={d.date} {...dropProps(null, d.date)}>
                  {shifts.filter((s) => !s.workerId && s.date === d.date && shown(s)).map(card)}
                  {addButton(null, d.date, "nobody yet, as an open shift")}
                </td>
              ))}
            </tr>
            {rows.map((w) => (
              <tr key={w.id} className="align-top">
                <th scope="row" className="border-b border-zinc-200 p-2 font-medium dark:border-zinc-800">
                  {w.name}
                  {w.summary && <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">{w.summary}</span>}
                </th>
                {days.map((d) => (
                  <td key={d.date} {...dropProps(w.id, d.date)}>
                    {leave
                      .filter((l) => l.workerId === w.id && l.date === d.date)
                      .map((l, i) => (
                        <p
                          key={i}
                          className={`mb-1.5 rounded-lg p-1.5 text-xs ${l.requested ? "border border-dashed border-sky-600" : "bg-sky-100 dark:bg-sky-950"}`}
                        >
                          {l.label}
                          {l.requested && " (asked for)"}
                        </p>
                      ))}
                    {unavailable
                      .filter((u) => u.workerId === w.id && u.weekday === d.weekday)
                      .map((u, i) => (
                        <p key={i} className="mb-1.5 rounded-lg bg-zinc-100 p-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {unavailableText(u)}
                        </p>
                      ))}
                    {shifts.filter((s) => s.workerId === w.id && s.date === d.date && shown(s)).map(card)}
                    {addButton(w.id, d.date, w.name)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <ShiftDialog
          key={open.mode === "edit" ? open.shiftId : `${open.workerId}|${open.date}`}
          {...props}
          shift={editing}
          workerId={open.mode === "add" ? open.workerId : (editing?.workerId ?? null)}
          date={open.mode === "add" ? open.date : (editing?.date ?? days[0]!.date)}
          nameById={nameById}
          onClose={(done) => {
            setOpen(null);
            if (done) setMessage(done);
          }}
          onGive={(workerId) => {
            if (!editing) return;
            setOpen(null);
            move(editing.id, workerId, editing.date);
          }}
        />
      )}
    </div>
  );
}

function ShiftDialog({
  shift,
  workerId,
  date,
  days,
  workers,
  roles,
  training,
  clients,
  usualTimes,
  nameById,
  onClose,
  onGive,
}: Props & {
  shift?: BoardShift;
  workerId: string | null;
  date: string;
  nameById: Map<string, string>;
  onClose: (done?: FormState) => void;
  onGive: (workerId: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveShift, {});
  const [start, setStart] = useState(shift?.start ?? "");
  const [end, setEnd] = useState(shift?.end ?? "");
  const [cancelling, startCancel] = useTransition();
  const [split, setSplit] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  useEffect(() => {
    if (state.ok) onClose(state);
  }, [state, onClose]);

  const who = workerId ? nameById.get(workerId) : null;
  const heading = shift ? "Change this shift" : who ? `Add a shift for ${who}` : "Add a shift";

  return (
    <dialog
      ref={ref}
      onClose={() => onClose()}
      aria-labelledby="shift-dialog-title"
      className="m-auto max-h-[90dvh] w-[min(100%-2rem,36rem)] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
        <h2 id="shift-dialog-title" className="text-lg font-semibold">{heading}</h2>
        <button type="button" onClick={() => ref.current?.close()} className="rounded-lg px-3 py-1 hover:bg-brand-soft">
          Close
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        {shift && shift.problems.length > 0 && (
          <section aria-label="Things to look at" className="flex flex-col gap-2">
            {shift.problems.map((p, i) => (
              <p key={i} className={`rounded-lg border-l-4 p-3 text-sm ${p.severity === "block" ? "border-red-600 bg-red-50 dark:bg-red-950" : "border-amber-500 bg-warn-soft"}`}>
                <span className="font-semibold">{p.severity === "block" ? "Must fix: " : "Check: "}</span>
                {p.message}
              </p>
            ))}
          </section>
        )}

        {shift?.candidates && (
          <section aria-labelledby="who-can-take" className="flex flex-col gap-2">
            <h3 id="who-can-take" className="font-semibold">Who can take this?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Checked against the law, their training, leave and the times they can&rsquo;t work. People with fewer hours this week come first.
            </p>
            <ul className="flex flex-col gap-2">
              {shift.candidates
                .filter((c) => !c.blocks.length)
                .map((c) => (
                  <li key={c.workerId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{+c.hours.toFixed(2)} hours this week so far</p>
                      {c.warnings.map((w, i) => (
                        <p key={i} className="text-sm">Check: {w}</p>
                      ))}
                    </div>
                    <button type="button" onClick={() => onGive(c.workerId)} className={quietButton}>
                      Give to {c.name.split(" ")[0]}
                    </button>
                  </li>
                ))}
            </ul>
            {shift.candidates.every((c) => c.blocks.length) && <p>Nobody can take this shift without breaking a rule. The reasons are below.</p>}
            {shift.candidates.some((c) => c.blocks.length) && (
              <details className="rounded-lg border border-line p-2">
                <summary className="font-medium">Who can&rsquo;t, and why ({shift.candidates.filter((c) => c.blocks.length).length})</summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {shift.candidates
                    .filter((c) => c.blocks.length)
                    .map((c) => (
                      <li key={c.workerId} className="text-sm">
                        <span className="font-medium">{c.name}:</span> {c.blocks[0]}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <form action={action} className="flex flex-col gap-4">
          {shift && <input type="hidden" name="shiftId" value={shift.id} />}
          <Message state={state} />
          <label className="flex flex-col gap-1">
            <span className="font-medium">Who is working</span>
            <select name="workerId" defaultValue={workerId ?? ""} className={input}>
              <option value="">Nobody yet: an open shift staff can pick up</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Day</span>
            <select name="date" defaultValue={date} required className={input}>
              {days.map((d) => (
                <option key={d.date} value={d.date}>{d.long}</option>
              ))}
            </select>
          </label>
          {usualTimes.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">Usual times</legend>
              <div className="flex flex-wrap gap-2">
                {usualTimes.map((t) => {
                  const chosen = start === t.start && end === t.end;
                  return (
                    <button
                      key={`${t.start}-${t.end}`}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => {
                        setStart(t.start);
                        setEnd(t.end);
                      }}
                      className={`rounded-full border px-3 py-1 text-sm tabular-nums ${chosen ? "border-brand bg-brand-soft font-semibold text-heading" : "border-zinc-400 hover:bg-brand-soft"}`}
                    >
                      {t.start}–{t.end}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-medium">Starts</span>
              <input name="start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={input} />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-medium">Finishes</span>
              <input name="end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
            </label>
          </div>
          {!shift && (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
              <legend className="px-1 font-medium">Split shift</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="split" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Add a second part later the same day
              </label>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                For example 07:00 to 10:00 and 16:00 to 19:00. The time in between is unpaid and not working time. Each part is clocked in and out on its own.
              </p>
              {split && (
                <div className="flex gap-4">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">Second part starts</span>
                    <input name="start2" type="time" required className={input} />
                  </label>
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">Second part finishes</span>
                    <input name="end2" type="time" required className={input} />
                  </label>
                </div>
              )}
            </fieldset>
          )}
          {shift?.split && (
            <p className="rounded-lg bg-brand-soft p-3 text-sm">
              This is part {shift.split.part} of {shift.split.of} of a split shift. Changes here are to this part only. Dragging it moves every part together.
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium">Unpaid break (minutes){split ? ", first part" : ""}</span>
            <input name="breakMinutes" type="number" min={0} max={240} defaultValue={shift?.breakMinutes ?? 0} className={input} />
          </label>
          {roles.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Job role</span>
              <select name="roleId" defaultValue={shift?.roleId ?? ""} className={input}>
                <option value="">No particular role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {shift?.roleId && roles.find((r) => r.id === shift.roleId) && (
                <span className="mt-1">
                  <RoleBadge name={roles.find((r) => r.id === shift.roleId)!.name} colour={roles.find((r) => r.id === shift.roleId)!.colour} />
                </span>
              )}
            </label>
          )}
          {clients && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Visit to (optional)</span>
                <select name="clientId" defaultValue={shift?.clientId ?? ""} className={input}>
                  <option value="">Not a visit</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Travel time from the previous visit (minutes)</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Travel between visits counts as working time for the minimum wage.</span>
                <input name="travelMinutes" type="number" min={0} max={240} defaultValue={shift?.travelMinutes ?? 0} className={input} />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium">What to expect (optional)</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Anything that helps the person know what the shift will be like, for example &ldquo;Delivery at 10, please help unload&rdquo;. They see it with
              their shift.
            </span>
            <textarea name="note" rows={2} maxLength={500} defaultValue={shift?.note ?? ""} className={input} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">Working alone</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="loneWorking" defaultChecked={shift?.loneWorking ?? false} /> This person will be working on their own
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">They check in at the start, at this interval, and at the end. You see who is late.</span>
              <select name="checkInMinutes" defaultValue={String(shift?.checkInMinutes ?? 60)} aria-label="Check in every" className={input}>
                {[30, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>Check in every {m < 60 ? `${m} minutes` : m === 60 ? "hour" : `${m / 60} hours`}</option>
                ))}
              </select>
            </label>
          </fieldset>
          {training.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">Training this shift needs</legend>
              {training.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" name="requires" value={t.id} defaultChecked={shift?.requires.includes(t.id) ?? false} /> {t.name}
                </label>
              ))}
            </fieldset>
          )}
          {shift?.status === "published" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">This shift is published. If you change the person or the times, they are told straight away.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={button}>
              {pending ? "Saving and checking…" : shift ? "Save changes" : "Add shift"}
            </button>
            <button type="button" onClick={() => ref.current?.close()} className={quietButton}>
              Close without saving
            </button>
          </div>
        </form>

        {shift && (
          <div className="border-t border-line pt-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {shift.status === "published" && shift.workerId ? "Cancelling tells the person straight away." : "Cancelling removes it from the rota."}
            </p>
            <button
              type="button"
              disabled={cancelling}
              onClick={() =>
                startCancel(async () => {
                  const form = new FormData();
                  form.set("shiftId", shift.id);
                  await cancelShift(form);
                  onClose({ ok: "Shift cancelled." });
                })
              }
              className="mt-2 rounded-lg border border-red-600 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
            >
              {cancelling ? "Cancelling…" : "Cancel this shift"}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
