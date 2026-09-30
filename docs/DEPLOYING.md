# Deploying Bullpen: step-by-step

About 15 minutes, all on free tiers. Vercel hosts the app and, through its Neon integration, creates the database for you. The first build sets up everything: the tables and all ~12,000 US stocks and ETFs. Nothing needs to run on your laptop.

> **Never commit `.env`.** It's already in `.gitignore`. Secrets go in Vercel's settings (and your local `.env` if you develop locally), nowhere else.

---

## 0. Accounts you need

| Service                                          | What for                                    | Required?                            |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------ |
| [GitHub](https://github.com)                     | Hosts the code; Vercel deploys from it      | Yes                                  |
| [Vercel](https://vercel.com)                     | Hosts the app and creates the Neon database | Yes (sign up **with GitHub**)        |
| [Finnhub](https://finnhub.io)                    | Real stock prices for all ~12k stocks       | Strongly recommended                 |
| [Ably](https://ably.com)                         | Instant leaderboard/feed updates            | Optional (falls back to 10s polling) |
| [Upstash](https://upstash.com)                   | Rate limiting shared across servers         | Optional (falls back to in-memory)   |
| [Google Cloud](https://console.cloud.google.com) | "Continue with Google" button               | Optional                             |

Bullpen only shows real prices, so you need a Finnhub key (it's free: sign up at <https://finnhub.io/register>, the key is on your dashboard). Without one, prices show as unavailable.

---

## 1. Put the code on GitHub

1. Go to <https://github.com/new>. Name the repo `bullpen`. Leave "Add a README" **unticked**. Click **Create repository**.
2. In a terminal inside the project folder:

```bash
git remote add origin https://github.com/wr7mdmf7h4-cmyk/bullpen.git
```

```bash
git push -u origin main
```

---

## 2. Make two secrets

Run this twice in a terminal. The first result is `AUTH_SECRET` (signs logins), the second is `CRON_SECRET` (protects the daily job):

```bash
openssl rand -base64 32
```

---

## 3. Import the project into Vercel

1. Go to <https://vercel.com/signup> and choose **Continue with GitHub** (the free **Hobby** plan is fine).
2. On <https://vercel.com/new>, find `bullpen` and click **Import**.
   If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repo.
3. On the **Configure Project** screen, leave the build settings alone (the repo's `vercel.json` handles them). Open **Environment Variables** and add:

   | Key               | Value                          |
   | ----------------- | ------------------------------ |
   | `AUTH_SECRET`     | your first secret              |
   | `CRON_SECRET`     | your second secret             |
   | `FINNHUB_API_KEY` | your Finnhub key (recommended) |

4. Click **Deploy**. The build succeeds, but the site shows an error until the database is connected. That's expected; the build log says `DATABASE_URL is not set`.

---

## 4. Create the database (inside Vercel)

1. In your Vercel project, open the **Storage** tab → **Create Database** → choose **Neon** → **Continue**.
2. Accept Neon's terms, pick the **Free** plan and the region **Washington, D.C. (iad1)** (same as Vercel's default), and create it.
3. When asked, **connect it to the `bullpen` project** for all environments. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically; you never copy a password.

---

## 5. Redeploy and play

1. Go to **Deployments**, open the **⋯** menu on the latest deployment, and choose **Redeploy**.
2. This build log shows the setup happening: migrations applied and `✅ 11,9xx tradable symbols synced`. Later deploys keep everyone's data.
3. Open your URL (like `bullpen-xyz.vercel.app`), sign up, and press <kbd>⌘K</kbd> to search any stock.
4. Under **Settings → Cron Jobs** you should see `/api/cron/snapshot` running daily (portfolio snapshots + weekly stock-list refresh).

From now on, every `git push` to `main` redeploys automatically.

### Developing locally against the same database (optional)

Pull the environment variables Vercel now holds into a local `.env`:

```bash
npx vercel env pull .env
```

Then start the app locally:

```bash
npm run dev
```

### Alternative: bring your own Neon project

If you'd rather create the database at <https://neon.tech> yourself, add its pooled URL as `DATABASE_URL` and its direct URL as `DIRECT_URL` in Vercel's environment variables, then redeploy. The build does the rest.

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
- Update the app link in `README.md` and the website field on your GitHub repo.

Tip: check the **renewal** price, not just the first-year price, and turn on auto-renew so the link on your CV never dies.

---

## 8. Make it CV-ready

- In `README.md`, make sure the app link points at your domain, then push.
- On the GitHub repo page, click ⚙️ next to **About** and add a description, your Vercel URL as the website, and topics (`nextjs`, `typescript`, `postgres`, `prisma`, `trading`, `game`).
- Check the **Actions** tab shows a green tick.
- Optional: record a 10-second GIF of a profitable sell with confetti and add it to the top of the README.

---

## Troubleshooting

| Symptom                                              | Fix                                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Build fails at `prisma migrate deploy`               | If you brought your own Neon project, `DIRECT_URL` must be the non-pooled URL. With the Vercel integration this is automatic. |
| "Invalid environment variables" / error page         | The database isn't connected yet (step 4) or `AUTH_SECRET` is missing; fix it, then redeploy.                                 |
| Only ~54 stocks are searchable                       | The stock sync failed during the build (see the log). Redeploy, or wait for the daily cron.                                   |
| "Market closed" and Buy is disabled                  | Prices are real, so orders fill during US market hours (9:30am–4pm ET, weekdays). The countdown shows when it reopens.        |
| "We couldn't get a live price…"                      | Finnhub didn't return a price in time (free tier: 60 calls/min). Wait a minute and retry.                                     |
| Leaderboard updates every ~10 seconds, not instantly | Expected without Ably. Add `ABLY_API_KEY` for push updates.                                                                   |
| Google button missing                                | Both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set, then redeploy.                                                |
