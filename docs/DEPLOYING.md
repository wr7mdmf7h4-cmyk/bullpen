# Deploying Bullpen: step-by-step

About 30 minutes, all on free tiers. You'll create four accounts (GitHub, Neon, Finnhub, Vercel), load the database from your laptop once, and then Vercel builds and hosts the app.

> **Never commit `.env`.** It's already in `.gitignore`. Keys go in your local `.env` and in Vercel's settings, nowhere else.

---

## 0. Accounts you need

| Service                                          | What for                                | Required?                            |
| ------------------------------------------------ | --------------------------------------- | ------------------------------------ |
| [GitHub](https://github.com)                     | Hosts the code; Vercel deploys from it  | Yes                                  |
| [Neon](https://neon.tech)                        | Postgres database                       | Yes                                  |
| [Vercel](https://vercel.com)                     | Hosts the app (sign up **with GitHub**) | Yes                                  |
| [Finnhub](https://finnhub.io)                    | Real stock prices for all ~12k stocks   | Strongly recommended                 |
| [Ably](https://ably.com)                         | Instant leaderboard/feed updates        | Optional (falls back to 10s polling) |
| [Upstash](https://upstash.com)                   | Rate limiting shared across servers     | Optional (falls back to in-memory)   |
| [Google Cloud](https://console.cloud.google.com) | "Continue with Google" button           | Optional                             |

Without a Finnhub key everything still works, but prices come from the built-in simulation. For a real-market app, get the key (it's free).

---

## 1. Put the code on GitHub

1. Go to <https://github.com/new>. Name the repo `bullpen`. Leave "Add a README" **unticked**. Click **Create repository**.
2. In a terminal inside the project folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/bullpen.git
```

```bash
git push -u origin main
```

Refresh the GitHub page and your code should be there. The **Actions** tab starts running CI (lint, types, tests) automatically.

---

## 2. Create the database (Neon)

1. Sign up at <https://neon.tech> and click **New project**. Name it `bullpen` and pick the region closest to you. (Vercel defaults to Washington D.C. (`iad1`), so **AWS US East (N. Virginia)** is a good match.)
2. On the project dashboard click **Connect**. You need **two** connection strings:
   - With **Connection pooling ON**: copy it. This is your `DATABASE_URL` (the host contains `-pooler`).
   - With **Connection pooling OFF**: copy it. This is your `DIRECT_URL`.

Both look like `postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.

---

## 3. Get your keys

**Two random secrets.** Run this twice; one result is `AUTH_SECRET`, the other is `CRON_SECRET`:

```bash
openssl rand -base64 32
```

**Finnhub key.** Sign up at <https://finnhub.io/register>; your API key is on the dashboard. That's `FINNHUB_API_KEY`.

---

## 4. Load the database from your laptop (once)

1. Open `.env` in the project folder and replace its contents with:

```dotenv
DATABASE_URL="<pooled Neon URL>"
DIRECT_URL="<direct Neon URL>"
AUTH_SECRET="<first secret>"
CRON_SECRET="<second secret>"
FINNHUB_API_KEY="<your Finnhub key>"
```

2. Create the tables:

```bash
npm run db:migrate
```

3. Load every US stock and ETF (about 12,000; takes a few seconds):

```bash
npm run instruments:sync
```

4. Add the demo world (demo account, 6 bot traders, a private league, 45 days of trades):

```bash
npm run db:seed
```

5. Check it locally:

```bash
npm run dev
```

Open <http://localhost:3000>, click **Try the demo**, then search for any ticker (for example `BRK.B` or `HOOD`) with <kbd>⌘K</kbd>.

---

## 5. Deploy on Vercel

1. Go to <https://vercel.com/new> and **Import** your `bullpen` repo. Vercel detects Next.js; leave the build settings alone (`vercel.json` already runs migrations and the stock sync before building).
2. Open **Environment Variables** and add the same five values from step 4:
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `FINNHUB_API_KEY`.
3. Click **Deploy** and wait about 2 minutes.
4. Open the URL Vercel gives you (like `bullpen-xyz.vercel.app`) and click **Try the demo**.
5. Under **Project → Settings → Cron Jobs** you should see `/api/cron/snapshot` scheduled daily. It records portfolio values and refreshes the stock list weekly.

From now on, every `git push` to `main` redeploys automatically.

---

## 6. Optional extras

After adding any variable in Vercel, go to **Deployments**, open the **⋯** menu on the latest deployment and choose **Redeploy**.

**Instant live updates (Ably)**

1. Sign up at <https://ably.com> and create an app.
2. Open **API Keys** and copy the **Root** key (it can publish and subscribe).
3. Add it as `ABLY_API_KEY`.

**Shared rate limiting (Upstash)**

1. Sign up at <https://upstash.com> and create a **Redis** database near your Vercel region.
2. In the **REST API** section, copy the URL and token.
3. Add them as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Google sign-in**

1. In <https://console.cloud.google.com> create a project, then go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in the app name and your email, and save.
2. Go to **Credentials → Create credentials → OAuth client ID** and choose **Web application**.
3. Under **Authorised redirect URIs** add `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google`.
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Google button appears after you redeploy.

---

## 7. Custom domain (optional)

**Option A: buy it inside Vercel (easiest).** Project → **Settings → Domains** → type the name → **Buy**. Vercel registers it, sets up DNS and HTTPS for you. Done.

**Option B: buy elsewhere (often cheaper).** Cloudflare Registrar, Porkbun and Namecheap all work. Then:

1. In Vercel: Project → **Settings → Domains** → **Add** → enter `yourdomain.com`. Accept the suggestion to also add `www.yourdomain.com` (redirecting to one of them).
2. Vercel shows the exact DNS records to create (usually an **A** record for the root domain and a **CNAME** for `www`). Copy them into your registrar's DNS settings.
3. Wait for Vercel to show **Valid Configuration** (minutes to a few hours). HTTPS certificates are issued automatically.

After the domain works:

- Nothing to change in the app itself: Auth.js trusts the host it's served on.
- If you use Google sign-in, add `https://yourdomain.com/api/auth/callback/google` to the OAuth client's redirect URIs.
- Update the demo link in `README.md` and the website field on your GitHub repo.

Tip: check the **renewal** price, not just the first-year price, and turn on auto-renew so the link on your CV never dies.

---

## 8. Make it CV-ready

- In `README.md`, replace `YOUR_GITHUB_USERNAME` and `YOUR-DEPLOYMENT` with your real values, then push.
- On the GitHub repo page, click ⚙️ next to **About** and add a description, your Vercel URL as the website, and topics (`nextjs`, `typescript`, `postgres`, `prisma`, `trading`, `game`).
- Check the **Actions** tab shows a green tick.
- Optional: record a 10-second GIF of a profitable sell with confetti and add it to the top of the README.

---

## Troubleshooting

| Symptom                                              | Fix                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Build fails at `prisma migrate deploy`               | `DIRECT_URL` missing or it's the pooled URL. Use the non-pooled one.                                                      |
| "Invalid environment variables"                      | `DATABASE_URL` or `AUTH_SECRET` isn't set in Vercel.                                                                      |
| Only ~54 stocks are searchable                       | The stock sync didn't run. Run `npm run instruments:sync` with your Neon URL, or wait for the daily cron.                 |
| "Market closed" and Buy is disabled                  | The Global League follows real US market hours (9:30–16:00 ET, weekdays). Switch to **24/7 Practice** in the league menu. |
| "We couldn't get a live price…"                      | Finnhub didn't return a price in time (free tier: 60 calls/min). Wait a minute and retry.                                 |
| Leaderboard updates every ~10 seconds, not instantly | Expected without Ably. Add `ABLY_API_KEY` for push updates.                                                               |
| Google button missing                                | Both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set, then redeploy.                                            |
