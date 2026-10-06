# Putting VicisRota live on a Hostinger VPS

This sets up VicisRota at https://vicisrota.app on one Hostinger VPS (a KVM 4 is plenty). Everything runs on that server:

- the app
- its database
- HTTPS certificates
- the 5-minute alert and reminder check
- nightly backups

It takes about 30 minutes, most of it waiting.

You will type a few commands. Copy and paste them exactly.

## 1. Before you start

- Merge the launch pull request and the deployment pull request on GitHub, so `main` has everything.
- Have your VPS's IP address to hand. In hPanel, go to **VPS**, open your server and look on its overview page. The address looks like `123.45.67.89`.

## 2. Set up the server's operating system

In hPanel, go to **VPS**, then **OS & Panel**, then **Operating System**. Choose **Ubuntu 24.04**: the plain one, not a template with a control panel or an app already installed.

This wipes the server, which is fine for a new one.

**Where your data lives.** Staff records are personal data under UK GDPR. If hPanel offers a choice of server location, pick the United Kingdom, or failing that a European Union location. If your VPS is somewhere else, tell me before going live, because your privacy notice would need to say so.

## 3. Point vicisrota.app at the server

In hPanel, go to **Domains**, then **vicisrota.app**, then **DNS / Nameservers**, then **DNS records**:

1. Delete any existing **A**, **AAAA** or **CNAME** records whose name is `@` or `www`. These are Hostinger's parking page.
2. Add an **A** record: name `@`, points to your VPS IP address.
3. Add an **A** record: name `www`, points to your VPS IP address.

It can take from a few minutes to a few hours before the address reaches the server. You can carry on in the meantime.

## 4. Install VicisRota

In hPanel, go to **VPS** and open **Browser terminal**. If you are comfortable with SSH, you can use `ssh root@your-ip` instead. Then paste these lines one at a time:

```
apt update && apt install -y git
git clone https://github.com/Anthony62dvla/vicisrota.git /opt/vicisrota
cd /opt/vicisrota/deploy && ./install.sh
```

The installer asks two questions:

- **Website address:** press Enter to accept `vicisrota.app`.
- **Your email:** used only for certificate notices from Let's Encrypt.

It then does the following:

- installs Docker
- opens the firewall for the website and SSH only
- creates strong random passwords
- builds and starts everything

The first build takes a few minutes. It finishes with **VicisRota is running at https://vicisrota.app**.

## 5. Make yourself the superadmin

1. Open https://vicisrota.app and sign up with your own email. Your business can be a test one.
2. Back in the terminal, run:

```
./superadmin.sh your@email.com
```

3. Reload the dashboard. The **VicisRota superadmin** link is where you set up customers.

## 6. Keep the secrets file safe

`/opt/vicisrota/deploy/.env` holds the database and sign-in passwords that the installer created. Show it with:

```
cat /opt/vicisrota/deploy/.env
```

Copy it into your password manager. If the server were ever lost, you would need it, together with a backup, to bring everything back.

## Everyday jobs

**Updating to the latest version.** After a pull request is merged:

```
cd /opt/vicisrota/deploy && ./update.sh
```

Any database changes are applied automatically.

**App notifications.** These are free, so staff who turn them on do not need texts. `update.sh` creates the keys for them the first time (the `VAPID_` lines in `.env`) and keeps them after that. Do not change or delete those lines, because new keys turn notifications off on everyone's phones. The first update that adds them runs the old copy of `update.sh`, so that time run:

```
cd /opt/vicisrota/deploy && ./ensure-keys.sh && ./update.sh
```

**Turning on real text messages.** Once you have your Text Global (or other bulk SMS) API details:

1. Run `nano /opt/vicisrota/deploy/app.env`.
2. Fill in the `SMS_` lines.
3. Save with Ctrl+O, then Enter, then Ctrl+X.
4. Run `./update.sh`.

Until then, texts are written to the log and not sent. Send me the provider's API page and I'll fill these lines in for you.

**Turning on error tracking.** Paste your Sentry DSN into `SENTRY_DSN` in `app.env`, and into `NEXT_PUBLIC_SENTRY_DSN` in `.env`, then run `./update.sh`.

**Turning on the support assistant.** Customers report problems from **Report a problem**, and you answer them from **Open support inbox** in the superadmin area. To have the assistant suggest a triage and a reply for each report, create an API key at https://platform.claude.com, paste it into `ANTHROPIC_API_KEY` in `app.env`, then run `./update.sh`. Nothing is sent to a customer until you send it.

**Turning on Xero Payroll.** Managers can send confirmed hours to Xero Payroll as draft timesheets. Go to https://developer.xero.com, choose **New app**, pick **Web app**, and use `https://vicisrota.app/api/xero/callback` as the redirect URI. Copy the client ID and generate a client secret. On the server, add them to `app.env` without showing them on screen: `read -rsp "Client ID: " v && echo "XERO_CLIENT_ID=$v" >> app.env`, then the same for `XERO_CLIENT_SECRET`, then run `./update.sh`. Each business then presses **Connect Xero** on its Timesheets page.

**Turning on sign-in with Microsoft or Google.** Either or both can be added; each button only shows once its keys are in `app.env`.

- Microsoft: in https://entra.microsoft.com go to **App registrations → New registration**. Choose "Accounts in any organizational directory and personal Microsoft accounts", and add the Web redirect URI `https://vicisrota.app/api/auth/callback/microsoft`. Copy the Application (client) ID, then create a client secret under **Certificates & secrets**.
- Google: in https://console.cloud.google.com go to **APIs & Services → Credentials → Create credentials → OAuth client ID**, choose **Web application**, and add the redirect URI `https://vicisrota.app/api/auth/callback/google`. Fill in the consent screen with the app name, hello@vicisrota.app, and the terms and privacy links.

Add the IDs and secrets to `app.env` the same hidden way as above (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), then run `./update.sh`. Accounts are never joined up by email on their own: people who already have a password link Microsoft or Google from **Sign-in security**. People with two-step sign-in on, and the superadmin, always sign in with their password and code.

**Switching on payments.** Until this is done, nothing is ever paused or charged. Do it in Stripe's test mode first, so no real money moves:

1. In Stripe, switch to **Test mode**, then go to **Developers → API keys** and copy the secret key (it starts `sk_test_`).
2. Go to **Developers → Webhooks → Add endpoint**. Use `https://www.vicisrota.app/api/stripe/webhook` and choose these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret (it starts `whsec_`).
3. Go to **Settings → Billing → Customer portal** and press **Save**, so customers can change their card and cancel.
4. Run `nano /opt/vicisrota/deploy/app.env`, fill in `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, save, and run `./update.sh`.
5. Try **Plan and billing** with Stripe's test card 4242 4242 4242 4242, any future date and any 3 digits.

When it all works, repeat steps 1 to 4 with Stripe's live keys. Prices and bands are set in `packages/compliance/src/plan.ts`.

**Backups.**

- A backup of the database is saved every night at about 02:30 to `/opt/vicisrota/deploy/backups`, and the last 30 are kept.
- These sit on the same server. Also turn on Hostinger's weekly VPS snapshots in hPanel, so a copy exists elsewhere.
- To go back to a backup, run `./restore.sh backups/vicisrota-YYYY-MM-DD.sql.gz`. This replaces everything since that night, so it asks you to type RESTORE first.

**If something looks wrong.**

```
cd /opt/vicisrota/deploy
docker compose ps
docker compose logs --tail=100 web
```

Send me the output along with any error reference shown on screen.

## What is running

| Part        | What it does                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `web`       | The VicisRota app                                                                                               |
| `db`        | PostgreSQL. The app uses a role that is not a superuser, so row-level security keeps each business's data apart |
| `migrate`   | Applies database changes on each start, then stops                                                              |
| `caddy`     | HTTPS for vicisrota.app. Sends www.vicisrota.app and plain http to https://vicisrota.app                        |
| `scheduler` | Every 5 minutes: lone-working alerts, late texts and shift reminders                                            |
| `backup`    | The nightly database backup                                                                                     |

The setup files are in `deploy/`. The GitHub repository is public, and no passwords are ever stored in it.
