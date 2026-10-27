# Wackometer

How wack are your lyrics? Paste a verse, the crew weighs it, the crowd decides if they got it right.

Runs entirely on Cloudflare: one Worker serves the site and the API, and a D1 database holds the Wall, votes, Daily W entries and accounts. Wingman and Roast mode use the Claude API. Pro and credits go through Stripe.

## What's in here

```
public/            the website (served as static files)
  index.html
  css/site.css
  js/app.js        the front end
  js/score.js      the scoring engine, shared with the API
  favicon.svg      Wretch
  og.png           link preview image
src/worker.js      the API (/api/*)
schema.sql         database tables
wrangler.toml      Cloudflare config
```

## Deploy it (about 20 minutes)

You need Node 18+ and a Cloudflare account.

1. **Install and log in**
   ```
   npm install
   npx wrangler login
   ```

2. **Create the database** and paste the `database_id` it prints into `wrangler.toml`:
   ```
   npx wrangler d1 create wackometer
   npm run db:remote
   ```

3. **Add your secrets** (each command asks you to paste the value):
   ```
   npx wrangler secret put SESSION_SECRET        # any long random string
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

## Known gaps before a big launch

- **Logging in on a second device.** Accounts live in one browser's cookie. If someone clears cookies, they lose Pro until you restore it. Add email magic-link login before you spend on ads.
- **Famous-lyric filter.** The checkbox and reports are the only guard against people posting copyrighted songs on the Wall. Watch reports closely at launch.
- **Moderation view.** Hidden posts stay in the database. There's no admin screen yet; use `npx wrangler d1 execute wackometer --remote --command "SELECT ..."`.
- **The link preview image** (`og.png`) was rendered without the Fredoka font. Retake it from the live site for a sharper version.
