import type { Metadata } from "next";
import Link from "next/link";
import { BANDS, PRICING } from "@vicisrota/compliance";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of service · VicisRota" };

const pounds = (pence: number) => `£${(pence / 100).toFixed(0)}`;

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={
        <p>
          These terms are the agreement between your business and {LEGAL.company}, which runs VicisRota. We have kept them as short and plain as we can. By
          creating an account or choosing a plan, you agree to them on behalf of your business.
        </p>
      }
      sections={[
        {
          id: "who",
          heading: "Who we are",
          body: (
            <p>
              VicisRota is run by {LEGAL.company}, a company registered in England and Wales, at {LEGAL.address}. You can contact us at{" "}
              <a href={`mailto:${LEGAL.email}`} className="underline">
                {LEGAL.email}
              </a>{" "}
              or through Report a problem in the app. In these terms, &ldquo;you&rdquo; means the business that uses VicisRota, and &ldquo;your staff&rdquo;
              means the people you add to it.
            </p>
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
                These checks help you get things right, but they are not legal advice. Decisions about your staff, their pay and their employment remain yours.
                If you are unsure about the law, take advice from a solicitor, ACAS or your sector body.
              </p>
              <p>
                Lone working check-ins, the fire roll call and Raise a concern help people get help, but VicisRota is not an emergency service. In an
                emergency, call 999.
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
              <li>You are responsible for who you give manager access to, and for what is done under your business&apos;s account.</li>
              <li>The information you put in, such as dates of birth, pay rates and checks, should be accurate and kept up to date.</li>
              <li>You must have a lawful reason to hold your staff&apos;s information in VicisRota, and tell them you use it. Our privacy policy can help.</li>
            </ul>
          ),
        },
        {
          id: "plans",
          heading: "Plans and payment",
          body: (
            <>
              <ul>
                <li>Up to {PRICING.freeStaff} people is free, with no time limit.</li>
                <li>
                  New businesses get a {PRICING.trialDays}-day free trial with no limit on people. No card is needed for the trial.
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
                <li>{LEGAL.company} is not registered for VAT, so no VAT is added.</li>
                <li>Payments are taken in advance by Stripe, our payment provider. You can change your card, see invoices and cancel on the Plan and billing page.</li>
              </ul>
              <p>
                If a payment fails, we will tell you and Stripe will try again. After {PRICING.graceDays} days, publishing new rotas and adding people pause
                until payment is made. Safety features, clocking in, your staff seeing their shifts, timesheets and payroll exports never stop, whatever happens with
                payment.
              </p>
            </>
          ),
        },
        {
          id: "cancel",
          heading: "Cancelling",
          body: (
            <>
              <p>
                You can cancel at any time on the Plan and billing page. Your plan carries on until the end of the period you have paid for, and we do not refund
                part periods, unless the law says we must. Your business then returns to the free plan if you have {PRICING.freeStaff} people or fewer.
              </p>
              <p>
                You can download your rotas, timesheets and payroll files at any time. If you want your business&apos;s account and records deleted, ask us at{" "}
                <a href={`mailto:${LEGAL.email}`} className="underline">
                  {LEGAL.email}
                </a>
                . Download anything you must keep first. Employers must keep some records, such as pay and working time, for several years.
              </p>
            </>
          ),
        },
        {
          id: "data",
          heading: "Your staff's information",
          body: (
            <>
              <p>
                For the information you put in about your staff, your business is the controller and {LEGAL.company} is your processor under UK GDPR. This
                means we:
              </p>
              <ul>
                <li>only use it to run VicisRota for you, following your instructions in the app, and never sell it or use it for advertising;</li>
                <li>keep it confidential, and only let people who need to, and are bound to keep it confidential, have access;</li>
                <li>keep it secure, with each business&apos;s records kept apart, encrypted connections and nightly backups;</li>
                <li>
                  only use the providers listed in our{" "}
                  <Link href="/privacy#providers" className="underline">
                    privacy policy
                  </Link>
                  , and tell you before we add or change one;
                </li>
                <li>help you answer requests from your staff to see, correct or delete their information;</li>
                <li>tell you without undue delay if we find a breach that affects your staff&apos;s information;</li>
                <li>delete or return it when you stop using VicisRota, unless the law requires us to keep it; and</li>
                <li>give you the information you need to show that we keep to these promises.</li>
              </ul>
              <p>Some of what VicisRota holds is sensitive, such as sickness, adjustments and safeguarding concerns. Only give access to people who need it.</p>
            </>
          ),
        },
        {
          id: "use",
          heading: "Fair use",
          body: (
            <ul>
              <li>Do not use VicisRota for anything unlawful, or to harass, discriminate against or monitor people beyond what the law allows.</li>
              <li>Do not try to get into other businesses&apos; records, test our security without permission, or overload the service.</li>
              <li>We may suspend an account that breaks these rules, and will tell you why unless the law stops us.</li>
            </ul>
          ),
        },
        {
          id: "availability",
          heading: "Keeping VicisRota running",
          body: (
            <p>
              We work hard to keep VicisRota available and your records safe, and we back them up every night. Sometimes we need to update it, and things can go
              wrong. We will fix problems as quickly as we can and tell you about planned updates that could affect you. We may improve or change features over
              time, and will give you notice before removing anything you rely on.
            </p>
          ),
        },
        {
          id: "liability",
          heading: "Our responsibility to you",
          body: (
            <>
              <p>
                Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else the law
                does not allow us to limit.
              </p>
              <p>
                Otherwise, we are not responsible for loss of profit, business or goodwill, or for loss that was not foreseeable. Our total responsibility to you in
                any 12 months is limited to the amount you paid us in those 12 months, or £100 if that is more.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to these terms",
          body: (
            <p>
              If we change these terms, we will tell you at least 30 days before the change takes effect, unless the law requires a faster change. If you do not
              agree, you can cancel before then. Price changes are covered by the same notice.
            </p>
          ),
        },
        {
          id: "law",
          heading: "Law and disagreements",
          body: (
            <p>
              If something goes wrong, please tell us first and we will try to put it right. These terms are governed by the law of England and Wales, and the
              courts of England and Wales can decide any dispute.
            </p>
          ),
        },
      ]}
    />
  );
}
