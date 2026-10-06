import type { Metadata } from "next";
import Link from "next/link";
import { BANDS, PRICING } from "@vicisrota/compliance";
import { LEGAL, registeredCompany } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of service · VicisRota" };

const pounds = (pence: number) => `£${(pence / 100).toFixed(0)}`;

const mail = (
  <a href={`mailto:${LEGAL.email}`} className="underline">
    {LEGAL.email}
  </a>
);

const privacy = (
  <Link href="/privacy" className="underline">
    privacy policy
  </Link>
);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={
        <p>
          These terms are the agreement between your business and {LEGAL.company}, which runs VicisRota. We have kept them as short and plain as we can.
          Schedule 1 (Data processing terms) is part of these terms.
        </p>
      }
      sections={[
        {
          id: "who",
          heading: "Who we are",
          body: (
            <>
              <p>
                VicisRota is run by {registeredCompany()}.{" "}
                {LEGAL.registeredOffice
                  ? `Our registered office is ${LEGAL.registeredOffice}, and we trade from ${LEGAL.address}.`
                  : `We trade from ${LEGAL.address}.`}{" "}
                {LEGAL.icoNumber && `We are registered with the Information Commissioner’s Office under number ${LEGAL.icoNumber}. `}
                You can contact us at {mail} or through Report a problem in the app.
              </p>
              <p>
                In these terms, “we” and “us” mean {LEGAL.company}, “you” means the business that uses VicisRota, and “your staff” means the people you add
                to it, including managers.
              </p>
            </>
          ),
        },
        {
          id: "agreeing",
          heading: "Agreeing to these terms",
          body: (
            <ul>
              <li>
                VicisRota is for businesses and other organisations, such as charities, not for personal use. By ticking to accept these terms when you create
                an account or choose a plan, you agree to them on behalf of your business.
              </li>
              <li>The person who accepts these terms confirms that they have authority to do so for the business.</li>
              <li>
                These terms, Schedule 1 and any price we agree with you in writing are the whole agreement between us. If they conflict, Schedule 1 wins on how
                we handle your staff’s information, and a price agreed in writing wins on price. Our {privacy} explains how we handle information but is not
                part of this contract.
              </li>
            </ul>
          ),
        },
        {
          id: "service",
          heading: "What VicisRota does",
          body: (
            <>
              <p>
                VicisRota helps you plan rotas, record hours, leave and checks, and keep your staff safe at work. It checks rotas against UK employment rules,
                such as rest breaks, working time, the minimum wage and right to work, and explains each warning.
              </p>
              <p>
                These checks help you get things right, but they are not legal advice, and they depend on the information you put in. We update them when the
                rules change, but we cannot promise that they cover every rule that applies to you, every exception or every change as soon as it happens.
                Decisions about your staff, their pay and their employment remain yours, and you remain responsible for complying with employment, tax and
                immigration law. If you are unsure about the law, take advice from a solicitor, ACAS or your sector body.
              </p>
            </>
          ),
        },
        {
          id: "safety",
          heading: "Safety features",
          body: (
            <>
              <p>
                Lone working check-ins, calls for help, the fire roll call and Raise a concern help people get help, but VicisRota is not an emergency service.
                In an emergency, call 999.
              </p>
              <p>
                These features depend on things outside our control, such as phone signal, internet connections, people’s devices and settings, and the text
                message and notification services we use. We cannot promise that every alert, text or notification will be delivered or arrive on time.
              </p>
              <p>
                You must keep your own lone working, fire safety and safeguarding procedures, and not rely on VicisRota as the only way of keeping people safe.
                You remain responsible for your staff’s health and safety at work.
              </p>
            </>
          ),
        },
        {
          id: "accounts",
          heading: "Your account",
          body: (
            <ul>
              <li>Keep your sign-in details private, and tell us straight away if you think someone else has used them.</li>
              <li>
                You are responsible for who you give manager access to, for making sure your staff use VicisRota in line with these terms, and for what is done
                under your business’s account.
              </li>
              <li>The information you put in, such as dates of birth, pay rates and checks, should be accurate and kept up to date.</li>
              <li>
                You must have a lawful reason to hold your staff’s information in VicisRota, and tell them you use it. Our {privacy} can help. Where you record
                health, safeguarding or check information, or use clocking in from phones, you are responsible for any assessment and policy the law requires,
                such as a data protection impact assessment or an appropriate policy document.
              </li>
            </ul>
          ),
        },
        {
          id: "plans",
          heading: "Plans and payment",
          body: (
            <>
              <ul>
                <li>
                  Up to {PRICING.freeStaff} people is free, with no time limit, for as long as we offer the free plan. We will give you at least 60 days’
                  notice before we end or reduce it.
                </li>
                <li>
                  New businesses get a {PRICING.trialDays}-day free trial with no limit on people. No card is needed for the trial, and you will not be charged
                  when it ends unless you choose a paid plan.
                </li>
                <li>
                  After that, the price depends on the size of your team:{" "}
                  {BANDS.map((b, i) => `${i === 0 ? PRICING.freeStaff + 1 : BANDS[i - 1]!.upTo + 1} to ${b.upTo} people ${pounds(b.monthPence)} a month`).join(
                    ", ",
                  )}
                  . For more than {BANDS.at(-1)!.upTo} people, we agree a price with you.
                </li>
                <li>Paying yearly costs the same as {PRICING.yearlyMonths} months. Registered charities and community interest companies pay half.</li>
                <li>
                  People you have marked as left are not counted. If your team moves into a different band, the new price starts from your next bill.
                </li>
                <li>
                  {LEGAL.company} is not currently registered for VAT, so no VAT is added. If we become registered, VAT will be added to our prices at the rate
                  that applies, and we will tell you at least 30 days before.
                </li>
                <li>
                  Paid plans renew automatically at the end of each month or year until you cancel. Payments are taken in advance by Stripe, our payment
                  provider. You can change your card, see invoices and cancel on the Plan and billing page.
                </li>
                <li>
                  If we change our prices, the new price applies from your next renewal after the notice in section 13. For yearly plans, that means your next
                  yearly renewal.
                </li>
              </ul>
              <p>
                If a payment fails, we will tell you and Stripe will try again. After {PRICING.graceDays} days, publishing new rotas and adding people pause until
                payment is made. If payment is still not made after 60 days, we may move your business to the free plan or end these terms under section 7.
                Safety features, clocking in, your staff seeing their shifts, timesheets and payroll exports do not stop because of a late payment while your
                account remains open.
              </p>
            </>
          ),
        },
        {
          id: "ending",
          heading: "Cancelling and ending",
          body: (
            <>
              <p>
                You can cancel at any time on the Plan and billing page. Your plan carries on until the end of the period you have paid for, and we do not refund
                part periods, unless the law says we must or section 13 says otherwise. Your business then returns to the free plan if you have{" "}
                {PRICING.freeStaff} people or fewer.
              </p>
              <p>You can close your business’s account completely by asking us at {mail}.</p>
              <p>We may end these terms, or suspend your account, by telling you in writing if:</p>
              <ul>
                <li>you have not paid for 60 days after a payment failed;</li>
                <li>
                  you seriously break these terms and, if the problem can be put right, do not put it right within 14 days of us asking you to;
                </li>
                <li>your business becomes insolvent, enters administration or liquidation, or stops trading; or</li>
                <li>
                  we stop providing VicisRota altogether, in which case we will give you at least 90 days’ notice and refund any amount paid for the period after
                  VicisRota stops.
                </li>
              </ul>
              <p>
                You can download your rotas, timesheets and payroll files at any time. When your account is closed or these terms end, you have 30 days to
                download anything you need. After that, we delete your business’s records as set out in Schedule 1. Employers must keep some records, such as
                pay and working time, for several years, so download them first.
              </p>
              <p>Sections 9, 12, 14 and 15 and Schedule 1 continue to apply after these terms end, for as long as they are relevant.</p>
            </>
          ),
        },
        {
          id: "ownership",
          heading: "Ownership",
          body: (
            <ul>
              <li>
                We own VicisRota, including its software, design, content and rota checks, and all the intellectual property rights in them. While these terms
                last, we give you and your staff a right to use VicisRota for your business. You must not copy, resell or reverse engineer it, except where the
                law allows.
              </li>
              <li>
                You own the information you and your staff put into VicisRota. You give us permission to use it only to provide VicisRota to you, as set out in
                these terms and Schedule 1.
              </li>
              <li>
                If you send us ideas or suggestions, we may use them to improve VicisRota without paying you, but we will not identify you without your
                agreement.
              </li>
            </ul>
          ),
        },
        {
          id: "data",
          heading: "Your staff’s information",
          body: (
            <>
              <p>
                For the information you put in about your staff, and about people who apply for jobs through VicisRota, your business is the controller and{" "}
                {LEGAL.company} is your processor under UK data protection law. Schedule 1 sets out how we handle it, as UK GDPR requires.
              </p>
              <p>Some of what VicisRota holds is sensitive, such as sickness, adjustments and safeguarding concerns. Only give access to people who need it.</p>
              <p>
                Where your staff add things that are private to them, such as wellbeing check-ins and their “How I work best” profile, we hold those for the
                member of staff, as explained in our {privacy}, until they choose to share them with you.
              </p>
            </>
          ),
        },
        {
          id: "fair-use",
          heading: "Fair use",
          body: (
            <ul>
              <li>Do not use VicisRota for anything unlawful, or to harass, discriminate against or monitor people beyond what the law allows.</li>
              <li>Do not try to get into other businesses’ records, test our security without permission, or overload the service.</li>
              <li>Do not put information into VicisRota that you have no right to hold.</li>
              <li>
                We may suspend an account, or a person’s access, that breaks these rules, and will tell you why unless the law stops us. Where we can, we will
                keep safety features and clocking in running while the problem is sorted out.
              </li>
            </ul>
          ),
        },
        {
          id: "running",
          heading: "Keeping VicisRota running",
          body: (
            <>
              <p>
                We work hard to keep VicisRota available and your records safe, and we back them up every night. Sometimes we need to update it, and things can
                go wrong, so we cannot promise that it will always be available or free from errors. We will fix problems as quickly as we can and tell you
                about planned updates that could affect you. We may improve or change features over time, and will give you at least 30 days’ notice before
                removing anything important you rely on.
              </p>
              <p>
                We are not responsible for delays or failures caused by things outside our reasonable control, such as power or internet failures, failures by
                the providers we use, cyber attacks we could not reasonably have prevented, or government action. We will tell you if this happens and do what
                we reasonably can to limit the effect.
              </p>
            </>
          ),
        },
        {
          id: "responsibility",
          heading: "Responsibility",
          body: (
            <>
              <h3>Our responsibility to you</h3>
              <p>
                Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else the law
                does not allow us to limit.
              </p>
              <p>Otherwise:</p>
              <ul>
                <li>
                  we are not responsible for loss of profit, revenue, business, contracts or goodwill, or for any indirect or consequential loss;
                </li>
                <li>
                  we are not responsible for fines, penalties, back pay, arrears or claims that arise because of your decisions about your staff, or because
                  information you put in was wrong or out of date;
                </li>
                <li>
                  if your records are lost or damaged, our responsibility is to restore them from our most recent backup as quickly as we reasonably can, and to
                  pay the reasonable cost of putting right what the backup cannot;
                </li>
                <li>
                  our total responsibility to you in any 12 months is limited to the amount you paid us in those 12 months, or £100 if that is more; and
                </li>
                <li>
                  for claims about how we handle your staff’s information under Schedule 1, our total responsibility in any 12 months is instead limited to twice
                  the amount you paid us in those 12 months, or £1,000 if that is more.
                </li>
              </ul>
              <h3>Your responsibility to us</h3>
              <p>
                You will cover our reasonable losses and costs if someone else makes a claim against us because you put information into VicisRota that you
                had no right to hold, gave us unlawful instructions, or used VicisRota against section 10.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to these terms",
          body: (
            <p>
              If we change these terms, we will tell you at least 30 days before the change takes effect, unless the law requires a faster change. If a change is
              to your disadvantage and you do not agree with it, you can cancel before it takes effect and, if you pay yearly, we will refund the unused part of
              your year. Price changes are covered by the same notice and section 6.
            </p>
          ),
        },
        {
          id: "general",
          heading: "General",
          body: (
            <ul>
              <li>
                Neither of us can transfer these terms to someone else without the other’s written agreement, except that we may transfer them to a business
                that takes over VicisRota, and we will tell you if we do.
              </li>
              <li>
                Only you and we can enforce these terms. No one else, including your staff, has a right to enforce them under the Contracts (Rights of Third
                Parties) Act 1999. This does not affect anyone’s rights under data protection law.
              </li>
              <li>If a court decides part of these terms cannot be enforced, the rest still applies.</li>
              <li>If either of us does not enforce a right straight away, we can still enforce it later.</li>
              <li>Each of us agrees that we have not relied on anything that is not in these terms. This does not limit responsibility for fraud.</li>
              <li>We will send notices to the email address of the owner of your business’s account, and you can send notices to {mail}.</li>
            </ul>
          ),
        },
        {
          id: "law",
          heading: "Law and disagreements",
          body: (
            <p>
              If something goes wrong, please tell us first and we will try to put it right. These terms are governed by the law of England and Wales, and the
              courts of England and Wales alone can decide any dispute.
            </p>
          ),
        },
      ]}
      schedule={{
        id: "data-processing",
        heading: "Data processing terms",
        body: (
          <>
            <p>
              This schedule applies to the information we process for you as your processor, as described in section 9. It is how we meet Article 28 of UK GDPR.
              Words such as “controller”, “processor”, “personal data” and “personal data breach” have the meaning they have in UK data protection law.
            </p>
            <h3>1. What we process</h3>
            <ul>
              <li>
                <strong>Subject matter and purpose:</strong> providing VicisRota to you, including planning and publishing rotas, checking them against
                employment rules, recording hours, leave, pay items and checks, sending messages and notifications, safety features, job applications and the
                other features you use.
              </li>
              <li>
                <strong>How long:</strong> for as long as these terms last, and then until deletion under paragraph 10.
              </li>
              <li>
                <strong>Nature of processing:</strong> storing, organising, displaying, checking, sending, exporting, backing up and deleting.
              </li>
              <li>
                <strong>Whose information:</strong> your staff, managers and owners, people who apply for your jobs, and anyone your staff mention in
                safeguarding concerns, handover notes or messages.
              </li>
              <li>
                <strong>Types of information:</strong> the information described in section 2 of our {privacy}, including health information (sickness,
                Statutory Sick Pay and adjustments), information about DBS checks, and safeguarding concerns that may include allegations of harm or of crimes.
              </li>
            </ul>
            <h3>2. Instructions</h3>
            <p>
              We will only process the information on your documented instructions, which are these terms, your settings and the actions you and your managers
              take in VicisRota, including on transfers outside the UK. If the law requires us to process it in another way, we will tell you before we do,
              unless the law forbids it. We will tell you straight away if we think an instruction breaks data protection law.
            </p>
            <h3>3. Confidentiality</h3>
            <p>We will make sure that everyone we authorise to process the information is bound to keep it confidential.</p>
            <h3>4. Security</h3>
            <p>
              We will take appropriate technical and organisational measures to keep the information secure, as Article 32 of UK GDPR requires. These include
              encrypted connections, scrambled passwords, keeping each business’s records apart in the database, logging changes to important records and to
              support staff actions, limiting our own staff’s access, and nightly backups.
            </p>
            <h3>5. Sub-processors</h3>
            <ul>
              <li>
                You give us general permission to use the providers listed in our{" "}
                <Link href="/privacy#providers" className="underline">
                  privacy policy
                </Link>{" "}
                as sub-processors.
              </li>
              <li>
                We will tell you at least 30 days before we add or replace a sub-processor. If you have a reasonable data protection reason to object, tell us
                within that time. We will try to address it, and if we cannot, you may end these terms and we will refund any amount paid for the period after
                they end.
              </li>
              <li>
                We will put a written contract in place with each sub-processor that gives the same protection as this schedule, and we remain responsible to
                you for what they do.
              </li>
            </ul>
            <h3>6. Transfers outside the UK</h3>
            <p>
              We will only transfer the information outside the UK, or allow a sub-processor to, where UK data protection law allows it, for example to a country
              the UK has approved or under the UK International Data Transfer Agreement or the UK Addendum.
            </p>
            <h3>7. Helping you</h3>
            <p>Taking into account what we process and the information available to us, we will help you:</p>
            <ul>
              <li>
                answer requests from people to see, correct, delete, limit, object to or move their information, mainly through the tools in VicisRota, and by
                passing on any request we receive directly;
              </li>
              <li>keep the information secure and deal with personal data breaches; and</li>
              <li>carry out data protection impact assessments and, if needed, consult the Information Commissioner’s Office.</li>
            </ul>
            <h3>8. Breaches</h3>
            <p>
              We will tell you without undue delay, and in any event within 48 hours, after we become aware of a personal data breach affecting the information.
              We will give you the details we have and update you as we learn more, so you can decide whether to report it to the Information Commissioner’s
              Office and tell the people affected.
            </p>
            <h3>9. Showing that we keep these promises</h3>
            <p>
              We will give you the information you reasonably need to show that we meet this schedule, and allow for and contribute to audits, including
              inspections, by you or an auditor you choose who is bound by confidentiality. Unless there has been a breach or a regulator requires it, audits are
              limited to one a year, with at least 30 days’ notice, at your cost, and we may first answer questions in writing.
            </p>
            <h3>10. Deletion and return</h3>
            <p>
              When these terms end, you can download your records in the formats VicisRota provides. Within 90 days after the end, we will delete the
              information, and deleted information will be overwritten in our backups within a further 30 days, unless the law requires us to keep it. While you
              are a customer, we apply the standard retention periods in section 6 of our {privacy} on your behalf. You agree to these periods as part of your
              instructions, and you can delete records sooner in VicisRota.
            </p>
          </>
        ),
      }}
    />
  );
}
