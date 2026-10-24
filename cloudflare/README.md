# Atomic reminder helper

A tiny Cloudflare Worker (free plan) that wakes the phone at habit reminder times.
It stores only push addresses, time zones and reminder minutes — no habit names or progress.

One-time setup (from this folder):

```bash
npx wrangler login
npx wrangler d1 create atomic-reminders        # copy the database_id into wrangler.toml
npx wrangler d1 execute atomic-reminders --remote --file=schema.sql
npx wrangler secret put VAPID_PRIVATE_JWK      # paste the contents of vapid-private.json
npx wrangler deploy                            # prints the helper's web address
```

Then put that address in `../.env.production` as `VITE_REMINDER_API` and run `npm run deploy` in the app folder.
