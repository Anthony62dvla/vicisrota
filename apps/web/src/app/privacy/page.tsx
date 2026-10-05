import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
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
                VicisRota is run by {LEGAL.company}, {LEGAL.address}. Contact us about privacy at {mail}.
              </p>
              <ul>
                <li>
                  <strong>If you work for a business that uses VicisRota,</strong> that business is responsible for your information (the controller). We hold it
                  for them (the processor) and only use it to run VicisRota for them.
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
              <p>About people who sign in: name, email address, a securely scrambled password, the language and display settings chosen, and which businesses they belong to.</p>
              <p>About staff, as entered by their employer or by themselves:</p>
              <ul>
                <li>name, date of birth (for minimum wage and under-18 rules), mobile number, start date, pay rate, payroll number and job roles;</li>
                <li>shifts, availability, leave, clock-in and clock-out times, timesheets and pay items;</li>
                <li>
                  right to work and DBS checks: the date, level and reference number only. The documents themselves are not uploaded to VicisRota;
                </li>
                <li>training, licences such as an SIA licence, supervisions and appraisals: dates only, never what was discussed;</li>
                <li>sickness dates and Statutory Sick Pay, and adjustments agreed with the person;</li>
                <li>
                  where someone clocks in from a phone: only whether they were at work and how far away, not where they were. Lone working check-ins and calls
                  for help;
                </li>
                <li>safeguarding concerns raised, team messages, checklists and handover notes;</li>
                <li>
                  things staff choose to add themselves: their &ldquo;How I work best&rdquo; profile and wellbeing check-ins. These are private unless the person
                  chooses to share them;
                </li>
                <li>job applications sent through a VicisRota job advert.</li>
              </ul>
              <p>About businesses: name, kind of business, plan and payment status, and charity number if given. Card details are held by Stripe, never by us.</p>
            </>
          ),
        },
        {
          id: "why",
          heading: "Why we use it",
          body: (
            <>
              <p>We use information only to run VicisRota: to plan and publish rotas, check them against UK employment law, record hours and pay, send rota changes and reminders, keep people safe at work and help businesses keep the records the law asks of them.</p>
              <p>
                For staff, the employer&apos;s legal reasons are usually the employment contract and their legal duties as an employer (for example working time,
                minimum wage, right to work, health and safety and safeguarding). Sickness and adjustments are health information, which employers may hold to meet
                their employment and equality law duties. For our own customers, our reasons are the contract with your business and keeping proper accounts.
              </p>
              <p>We never sell information, never use it for advertising and never use it to train AI.</p>
            </>
          ),
        },
        {
          id: "who-sees",
          heading: "Who can see it",
          body: (
            <ul>
              <li>Each business&apos;s records are kept apart in the database, so one business can never see another&apos;s.</li>
              <li>Managers and owners of a business see their own staff&apos;s records. Staff see their own shifts and information, not other people&apos;s.</li>
              <li>
                VicisRota&apos;s own support team sees counts and progress for each business, never staff personal details, sickness, adjustments or
                safeguarding concerns. Every action they take is logged.
              </li>
              <li>The providers below, only for the job they do for us.</li>
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
                  <strong>Hostinger</strong> runs the server VicisRota is on, in Manchester, UK. All the records above are stored there, with nightly backups on the
                  same server.
                </li>
                <li>
                  <strong>Stripe</strong> takes payments from businesses. It receives the business name, the email address of the person paying and card details.
                </li>
                <li>
                  <strong>Vonage</strong> sends text messages. It receives the mobile number and the text, such as a shift reminder or an alert.
                </li>
                <li>
                  <strong>Phone and browser notification services</strong> (Apple, Google and Mozilla) deliver app notifications to devices where people have
                  turned them on. They receive the notification&apos;s title and short message.
                </li>
                <li>
                  <strong>Anthropic</strong> helps us sort problem reports sent through Report a problem. It receives only the report, with email addresses and
                  phone numbers removed first, never staff records. Please do not put personal details in a problem report.
                </li>
              </ul>
              <p>
                Some of these providers may process information outside the UK. Where they do, they use safeguards approved under UK law, such as the UK
                International Data Transfer Agreement.
              </p>
            </>
          ),
        },
        {
          id: "keep",
          heading: "How long we keep it",
          body: (
            <ul>
              <li>Records are kept while the business uses VicisRota, so employers can keep the records the law requires, such as pay and working time.</li>
              <li>Job applications are deleted automatically after 180 days, unless the person is hired.</li>
              <li>Backups are kept for 30 days and then overwritten.</li>
              <li>
                When a business stops using VicisRota and asks us to, we delete its records. Employers should download anything they must keep before then.
              </li>
              <li>Our own billing records are kept for six years, as UK tax law requires.</li>
            </ul>
          ),
        },
        {
          id: "cookies",
          heading: "Cookies",
          body: (
            <p>
              VicisRota uses only the cookies it needs to work: one that keeps you signed in, one that remembers which business you have open and one that
              remembers your language. There are no advertising or tracking cookies, so we do not ask you to accept any. When a business pays, Stripe&apos;s
              payment page uses its own cookies to prevent fraud.
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
                <li>limit or object to how it is used; and</li>
                <li>have it given to you in a format you can take elsewhere.</li>
              </ul>
              <p>
                If you work for a business that uses VicisRota, ask your employer first, as they decide what is kept. You can also contact us at {mail} and we
                will pass your request to them and help them answer it. We will reply within one month.
              </p>
              <p>
                If you are unhappy with how your information is handled, please tell us. You can also complain to the Information Commissioner&apos;s Office at{" "}
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
            <p>
              Connections to VicisRota are encrypted. Passwords are scrambled so nobody can read them, including us. Each business&apos;s records are kept apart by
              the database itself, and changes to important records are logged. If something goes wrong that puts your information at risk, we will tell the
              business affected, and the Information Commissioner&apos;s Office where the law requires.
            </p>
          ),
        },
        {
          id: "changes",
          heading: "Changes to this policy",
          body: <p>If we change this policy in a way that matters, we will tell businesses using VicisRota before the change takes effect and update the date at the top.</p>,
        },
      ]}
    />
  );
}
