import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, registeredCompany } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy policy · VicisRota" };

const mail = (
  <a href={`mailto:${LEGAL.email}`} className="underline">
    {LEGAL.email}
  </a>
);

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          This explains what information VicisRota holds about you, why, who else sees it and what you can do about it. If you work for a business that uses
          VicisRota, your employer decides most of this, so please ask them first. You can always ask us too.
        </p>
      }
      sections={[
        {
          id: "who",
          heading: "Who is responsible",
          body: (
            <>
              <p>
                VicisRota is run by {registeredCompany()}
                {LEGAL.registeredOffice && `, with its registered office at ${LEGAL.registeredOffice}`}. We trade from {LEGAL.address}
                {LEGAL.icoNumber && `, and are registered with the Information Commissioner’s Office under number ${LEGAL.icoNumber}`}. Contact us about privacy
                at {mail}.
              </p>
              <ul>
                <li>
                  <strong>If you work for a business that uses VicisRota,</strong> or apply for a job through a VicisRota job advert, that business is
                  responsible for your information (the controller). We hold it for them (the processor) and only use it to run VicisRota for them, under a
                  contract that UK data protection law requires.
                </li>
                <li>
                  <strong>Things staff keep private to themselves,</strong> such as wellbeing check-ins and the “How I work best” profile, are the exception.
                  While they are private, we are responsible for them (the controller), because your employer cannot see them. Once you share them with your
                  employer, your employer is responsible for the shared copy.
                </li>
                <li>
                  <strong>If you run a business that uses VicisRota,</strong> or visit our website, we are responsible for your account and billing information
                  (the controller).
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "what",
          heading: "What we hold",
          body: (
            <>
              <p>
                About people who sign in: name, email address, a securely scrambled password, the language and display settings chosen, and which businesses
                they belong to.
              </p>
              <p>About staff, as entered by their employer or by themselves:</p>
              <ul>
                <li>name, date of birth (for minimum wage and under-18 rules), mobile number, start date, pay rate, payroll number and job roles;</li>
                <li>shifts, availability, leave, clock-in and clock-out times, timesheets and pay items;</li>
                <li>
                  right to work and DBS checks: the date, level and reference number only. The documents and certificates themselves are not uploaded to
                  VicisRota;
                </li>
                <li>training, licences such as an SIA licence, supervisions and appraisals: dates only, never what was discussed;</li>
                <li>sickness dates and Statutory Sick Pay, and adjustments agreed with the person;</li>
                <li>
                  where someone clocks in from a phone: only whether they were at work and how far away, not where they were. Lone working check-ins and calls
                  for help;
                </li>
                <li>
                  safeguarding concerns raised, team messages, checklists and handover notes. These can include information about other people, such as
                  children or adults being cared for;
                </li>
                <li>
                  things staff choose to add themselves: their “How I work best” profile and wellbeing check-ins. These are private unless the person chooses to
                  share them;
                </li>
                <li>job applications sent through a VicisRota job advert.</li>
              </ul>
              <p>
                About businesses: name, kind of business, plan and payment status, and charity number if given. Card details are held by Stripe, never by us.
              </p>
              <p>
                About everyone who uses VicisRota or our website: technical information our server records to keep things secure and working, such as IP
                address, browser and device type, and the times pages were used. We also keep emails and problem reports you send us.
              </p>
              <p>
                Some of this is health information (sickness, adjustments and some wellbeing check-ins), and safeguarding concerns may include allegations of
                crimes. The law protects this information more strictly, so access to it is limited, as explained in section 4.
              </p>
            </>
          ),
        },
        {
          id: "why",
          heading: "Why we use it",
          body: (
            <>
              <p>
                We use information only to run VicisRota: to plan and publish rotas, check them against UK employment law, record hours and pay, send rota
                changes and reminders, keep people safe at work and help businesses keep the records the law asks of them.
              </p>
              <h3>For staff and job applicants</h3>
              <p>The employer decides the legal reasons, which are usually:</p>
              <ul>
                <li>
                  the employment contract, and the employer’s legal duties, for example working time, minimum wage, right to work, health and safety and
                  safeguarding;
                </li>
                <li>
                  for sickness, adjustments and DBS checks, the employer’s duties under employment, social security, equality and safeguarding law, using the
                  conditions in Schedule 1 of the Data Protection Act 2018. Employers relying on these conditions must have an appropriate policy document;
                </li>
                <li>for job applications, taking steps at the applicant’s request before a possible contract.</li>
              </ul>
              <h3>For things staff keep private</h3>
              <p>
                Our reason is providing the feature the person has chosen to use. Where a wellbeing check-in includes health information, we rely on the
                person’s explicit consent, which they give by choosing to add it and can withdraw at any time by deleting it.
              </p>
              <h3>For our own customers and visitors</h3>
              <ul>
                <li>the contract with your business, to provide VicisRota, take payment and give support;</li>
                <li>our legal duties, such as keeping proper accounts for tax;</li>
                <li>
                  our legitimate interests in keeping VicisRota secure, preventing fraud and misuse, dealing with problem reports and improving how VicisRota
                  works. We only rely on these where they are not outweighed by your interests and rights.
                </li>
              </ul>
              <p>
                We send business contacts emails needed to run the account, such as invoices and notice of changes. If we send news about VicisRota, you can opt
                out at any time using the link in the email.
              </p>
              <p>
                We never sell information, never use it for advertising and never use it to train AI. VicisRota does not make decisions about people by
                automated means alone that have legal or similarly significant effects. Its rota checks give warnings, and a person at the business always
                decides what to do.
              </p>
            </>
          ),
        },
        {
          id: "who-sees",
          heading: "Who can see it",
          body: (
            <ul>
              <li>Each business’s records are kept apart in the database, so one business can never see another’s.</li>
              <li>Managers and owners of a business see their own staff’s records. Staff see their own shifts and information, not other people’s.</li>
              <li>
                VicisRota’s own support team sees counts and progress for each business, not staff personal details, sickness, adjustments or safeguarding
                concerns. A very small number of our technical staff can reach the database to keep it running and fix serious problems. They only do so when
                needed, and every action is logged.
              </li>
              <li>The providers below, only for the job they do for us.</li>
              <li>
                Others where the law requires it, for example the police or a regulator with a legal right to the information, or to protect someone’s life.
              </li>
            </ul>
          ),
        },
        {
          id: "providers",
          heading: "Providers we use",
          body: (
            <>
              <ul>
                <li>
                  <strong>Hostinger</strong> runs the server VicisRota is on, in Manchester, UK. All the records above are stored there, with nightly backups
                  on the same server.
                </li>
                <li>
                  <strong>Stripe</strong> takes payments from businesses. It receives the business name, the email address of the person paying and card
                  details.
                </li>
                <li>
                  <strong>Xero</strong>, only for businesses that connect it, receives each person’s confirmed hours, linked to their employee record in Xero,
                  so their pay can be worked out in Xero Payroll. Once there, the information is handled under the business’s own agreement with Xero.
                </li>
                <li>
                  <strong>Microsoft and Google</strong>, only for people who choose to sign in with one of those accounts, confirm who you are and give us your
                  name and email address. We do not receive your Microsoft or Google password.
                </li>
                <li>
                  <strong>Vonage</strong> sends text messages. It receives the mobile number and the text, such as a shift reminder or an alert.
                </li>
                <li>
                  <strong>Phone and browser notification services</strong> (Apple, Google and Mozilla) deliver app notifications to devices where people have
                  turned them on. They receive the notification’s title and short message.
                </li>
                <li>
                  <strong>Anthropic</strong> helps us sort problem reports sent through Report a problem. It receives only the report, with email addresses and
                  phone numbers removed first, and never staff records. Names or other details someone types into a report may still be included, so please do
                  not put personal details in a problem report. We use Anthropic’s commercial service, which does not use our information to train its models.
                </li>
              </ul>
              <h3>Information sent outside the UK</h3>
              <p>
                Stripe, Vonage, Anthropic, Microsoft, Google, Apple and Mozilla may process information in the United States or other countries outside the UK.
                Where they do, the transfer is protected by the UK–US Data Bridge, for providers certified under it, or by the UK International Data Transfer
                Agreement or the UK Addendum to the EU standard contractual clauses. You can ask us for a copy of the safeguards at {mail}.
              </p>
            </>
          ),
        },
        {
          id: "keep",
          heading: "How long we keep it",
          body: (
            <>
              <p>These are the standard periods. Each business agrees to them when it uses VicisRota, and can delete records sooner.</p>
              <ul>
                <li>
                  Records are kept while someone works for the business, so employers can keep the records the law requires, such as pay and working time.
                </li>
                <li>
                  Two years after someone leaves, VicisRota deletes their right to work and DBS check records, wellbeing check-ins, agreed adjustments, their
                  “How I work best” profile, mobile number and notifications.
                </li>
                <li>
                  Six years after someone leaves, everything else about them is deleted, including shifts worked, pay, holiday and sickness records. Six years is
                  how long a claim about work can be brought, and how long minimum wage records must be kept.
                </li>
                <li>App notifications and the record of text messages sent are deleted after one year.</li>
                <li>
                  Safeguarding records are not deleted automatically, because they may need to be kept for much longer to protect children and adults at risk.
                  The business is responsible for reviewing them regularly and deleting those that no longer need to be kept.
                </li>
                <li>Job applications are deleted automatically after 180 days, unless the person is hired.</li>
                <li>Server security records are kept for 90 days, and emails and problem reports for two years.</li>
                <li>Backups are kept for 30 days and then overwritten.</li>
                <li>
                  When a business closes its account, it has 30 days to download its records. We then delete them within 90 days, and they are overwritten in
                  backups 30 days after that.
                </li>
                <li>Our own billing records are kept for six years, as UK tax law requires.</li>
              </ul>
            </>
          ),
        },
        {
          id: "cookies",
          heading: "Cookies",
          body: (
            <p>
              VicisRota uses only the cookies it needs to work: one that keeps you signed in, one that remembers which business you have open, one that
              remembers your language and display choices, one that links a shared clock-in tablet to its workplace, and a short-lived one while a manager
              connects Xero. There are no advertising or tracking cookies, so we do not ask you to accept any. When a business pays, Stripe’s payment page uses
              its own cookies to prevent fraud.
            </p>
          ),
        },
        {
          id: "rights",
          heading: "Your rights",
          body: (
            <>
              <p>Under UK data protection law you can ask to:</p>
              <ul>
                <li>see the information held about you, and get a copy;</li>
                <li>have it corrected if it is wrong, or deleted where it no longer needs to be kept;</li>
                <li>limit or object to how it is used;</li>
                <li>have it given to you in a format you can take elsewhere; and</li>
                <li>withdraw your consent, where we rely on it, at any time. This does not affect what was done before.</li>
              </ul>
              <p>
                Some rights depend on the legal reason for using the information, and an employer may need to keep some records even if you ask them to delete
                them.
              </p>
              <p>
                Staff can download a copy of their own data at any time from their{" "}
                <Link href="/me" className="underline">
                  own page
                </Link>{" "}
                in VicisRota.
              </p>
              <p>
                If you work for a business that uses VicisRota, ask your employer first, as they decide what is kept. You can also contact us at {mail} and we
                will pass your request to them and help them answer it. For information we are responsible for, we will reply within one month.
              </p>
              <h3>Complaints</h3>
              <p>
                If you are unhappy with how your information is handled, please tell us at {mail}. We will confirm we have received your complaint within 30
                days, look into it and tell you the outcome. You can also complain to the Information Commissioner’s Office at{" "}
                <a href="https://ico.org.uk/make-a-complaint/" className="underline">
                  ico.org.uk
                </a>{" "}
                or on 0303 123 1113.
              </p>
            </>
          ),
        },
        {
          id: "security",
          heading: "Keeping it safe",
          body: (
            <>
              <p>
                Connections to VicisRota are encrypted. Passwords are scrambled so nobody can read them, including us. Each business’s records are kept apart
                by the database itself, and changes to important records are logged.
              </p>
              <p>
                If something goes wrong that puts information at risk, we will tell the business affected straight away, so it can tell the Information
                Commissioner’s Office and the people affected where the law requires. For information we are responsible for, we will tell the Information
                Commissioner’s Office and the people affected ourselves where the law requires.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to this policy",
          body: (
            <p>
              If we change this policy in a way that matters, we will tell businesses using VicisRota before the change takes effect and update the date at the
              top.
            </p>
          ),
        },
      ]}
    />
  );
}
