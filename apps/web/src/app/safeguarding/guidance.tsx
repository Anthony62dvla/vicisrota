/** Where to go when someone is in danger, or when a concern cannot be raised inside the business. */
export function OutsideHelp({ sector }: { sector: string }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p>
        <strong>If someone is in danger now, call 999 first.</strong> Then record it here.
      </p>
      <p>If the concern is about a manager, or you are not happy with how it is being handled, you can go outside the business:</p>
      <ul className="ml-5 list-disc">
        <li>Your local council&apos;s adult or children&apos;s safeguarding team (search your council&apos;s name and &quot;safeguarding&quot;).</li>
        <li>Police non-emergency: 101.</li>
        {sector === "care" && <li>Care Quality Commission (England): 03000 616161.</li>}
        <li>Health and Safety Executive, for something unsafe at work.</li>
        <li>NSPCC whistleblowing advice line, about children: 0800 028 0285.</li>
        <li>Protect, free confidential whistleblowing advice: 020 3117 2520.</li>
      </ul>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The law protects workers who raise concerns in the public interest (Public Interest Disclosure Act 1998). You must not be treated
        badly for raising one.
      </p>
    </div>
  );
}
