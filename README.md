# Wackometer

How wack are your lyrics? Paste a verse, the crew weighs it, the crowd decides if they got it right.

Runs entirely on Cloudflare: one Worker serves the site and the API, and a D1 database holds the Wall, votes, Daily W entries and accounts. Wingman and Roast mode use the Claude API. Pro and credits go through Stripe.

## What's in here

```
web/               the website source: edit these
  index.html, terms.html, privacy.html, admin.html
  css/site.css
  js/app.js        the front end
  js/score.js      the scoring engine, shared with the API
  fonts/           self-hosted Fredoka
  _headers         cache and security headers
public/            built from web/ by `npm run build` (minified, cache-stamped). Cloudflare serves this.
scripts/build.mjs  the build
src/worker.js      the API (/api/*)
schema.sql         database tables
wrangler.toml      Cloudflare config
```

## Making changes

Edit files in `web/`, then run `npm run build` and commit both `web/` and `public/`. Pushing to GitHub deploys automatically.

## Deploy it (about 20 minutes)

You need Node 18+ and a Cloudflare account.

1. **Install and log in**
   ```
   npm install
   npx wrangler login
   ```

2. **Database.** Already created (`wackometer`, id in `wrangler.toml`). The worker creates its tables on first request. To make a new one instead:
   ```
   npx wrangler d1 create wackometer
   npm run db:remote
   ```

3. **Add your secrets** (each command asks you to paste the value):
   ```
   npx wrangler secret put SESSION_SECRET        # optional: any long random string. If unset, the site generates one and keeps it in the database.
   npx wrangler secret put ANTHROPIC_API_KEY     # console.anthropic.com → API keys
   ```
   The site works without Stripe. Pro checkout just shows "not connected yet" until step 6.

4. **Deploy**
   ```
   npm run deploy
   ```
   You'll get a `wackometer.<you>.workers.dev` link that works right away.

5. **Point your domain.** In the Cloudflare dashboard: Workers & Pages → wackometer → Settings → Domains & Routes → Add custom domain. Then set `APP_URL` in `wrangler.toml` to `https://yourdomain.com` and deploy again.

6. **Turn on payments (Stripe)**
   - In Stripe, create a product "Wingman Pro" with two recurring prices ($7.99/month, $59/year) and a product "Wingman Credits" with a one-time $4.99 price.
   - Put the three price ids in `wrangler.toml` (`PRO_PRICE_MONTHLY`, `PRO_PRICE_YEARLY`, `CREDITS_PRICE`).
   - Add a webhook endpoint at `https://yourdomain.com/api/stripe/webhook` for these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Turn on the Customer Portal in Stripe settings so "Manage billing" works.
   - Save the keys and deploy:
     ```
     npx wrangler secret put STRIPE_SECRET_KEY
     npx wrangler secret put STRIPE_WEBHOOK_SECRET
     npm run deploy
     ```
   Test with Stripe's test mode keys first (card 4242 4242 4242 4242).

7. **Set your contact email** for the Classrooms plan: `CONTACT_EMAIL` at the top of `public/js/app.js`.

## Turn on email sign-in (optional but recommended)

1. In SendGrid: Settings → Sender Authentication → **Authenticate your domain** for wackometer.com, and add the DNS records it shows you in Cloudflare (DNS → Records). Turn off the Cloudflare proxy (grey cloud) on those CNAMEs.
2. Settings → API Keys → Create API Key with **Restricted Access → Mail Send: Full Access**. Copy the key (starts with `SG.`). SendGrid shows it once.
3. Add it in Cloudflare as a secret named `SENDGRID_API_KEY` (Workers & Pages → wackometer → Settings → Variables and Secrets), or `npx wrangler secret put SENDGRID_API_KEY`.
4. Sign-in emails come from `EMAIL_FROM` in `wrangler.toml` (default `hello@wackometer.com`). It must be on the domain you authenticated. The admin screen at `/admin` opens for the emails in `ADMIN_EMAILS`.

## Run it on your computer

```
npm install
npm run db:local
echo "SESSION_SECRET=anything-long" > .dev.vars
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .dev.vars     # optional, for Wingman
npm run dev
```
Open http://localhost:8787.

## How it works

- **Accounts.** Each visitor gets an anonymous account in a signed cookie, so there's no sign-up wall. Pro, credits, streaks and leaderboard names attach to that account.
- **Scoring** runs in the browser for instant results. When someone posts to the Wall or enters the Daily W, the server re-scores the text itself so nobody can fake a number.
- **Crowd tune.** Once 3 posts have 3+ votes each, the average gap between the crowd and the meter shifts every new score, capped at ±15.
- **Featured.** Wall posts with 5+ votes move to Featured.
- **Wingman limit.** 5 messages a day free, counted on the server. Roasts count as a message. Pro is unlimited; credits are used after the free 5 run out.
- **Daily W.** One prompt per day for everyone (rolls over at midnight Eastern, list in `score.js`). One entry per person. Crew board ranks by lowest score; Crowd board ranks by 🔥.
- **Safety.** Posting needs a "these are my own lyrics" checkbox. Three reports hide a post. Max 10 Wall posts per person per day. Daily W rejects keyboard-mash entries.

## Features

- **Weigh** with the crew, the Wack map, tap-to-swap clichés, Wiz's best-line pick, Wobbles' syllable check, live reactions while you type, Roast mode, share images and 6-second share videos.
- **Daily W** with emoji prompts, streaks, unlockable crew outfits (3, 7 and 30 days), Crew and Crowd boards.
- **Pass the Pen**: `/pen/<id>` songs written one line at a time by different people (16 lines max, nobody twice in a row).
- **Wall** with tier votes, 🔥😭💀🤢 reactions, Featured, reports.
- **Wingman** chat, emoji starters, Pro and credits.
- **Squad**: customizable profiles at `/u/<username>` (crew avatar, color, bio, genre, signature line, music links, stats, unlocks), friend requests and search, W Points leaderboards (squad or everyone, week or today) and blind head-to-head battles between friends.
- **Light and dark mode**: follows the device by default, with a toggle in the header.
- **Admin** at `/admin`: totals, share/save counts by day, reported posts to hide, restore or delete.

## Known gaps before a big launch

- **Email sign-in needs SendGrid.** Until `SENDGRID_API_KEY` is set, accounts live in one browser's cookie.
- **Famous-lyric filter.** The checkbox and reports are the only guard against people posting copyrighted songs on the Wall. Watch reports closely at launch.
- **The link preview image** (`og.png`) was rendered without the Fredoka font. Retake it from the live site for a sharper version.
