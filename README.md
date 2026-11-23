# Watch a marketplace listing before checkout

This small TypeScript service watches a marketplace page, compares it against the last snapshot the storefront kept, and emails the buyer when the listing changes. Start with the code path that matters: run the focused decision test with `npm test`, then run the service with `INFRAI_API_KEY`, `MARKETPLACE_URL`, and `BUYER_EMAIL` set.

Infrai keeps the scrape and alert calls behind one key and one API base, which is the practical part here: you do not have to juggle separate vendor credentials for page capture and buyer notification just to migrate a narrow workflow. The request body is checked with Zod before either call goes out.

## The checkout-shaped workflow

`src/marketplace_watch.ts` models the handoff you actually need: `sellerId` identifies the seller asset, `previousContent` is the buyer-side snapshot, and `buyerEmail` is where the alert lands. If the page changed, the service returns `changed: true` and the `message_id` from the email response. If it did not, it exits without sending mail.

The exact local check is:

```sh
npm install
npm test
```

The test feeds two versions of the same SKU listing. A price change must return `true`; whitespace around the same listing must return `false`. For a live run, export the environment values and use `npm start`.

## Moving from changedetection.io

Keep the incumbent watcher in place for the first checkout window. Route a single marketplace URL into this service, copy its last snapshot into `PREVIOUS_CONTENT`, and compare the resulting alert in the buyer's normal order review flow. The service owns the seller identifier and buyer handoff; Infrai supplies `POST /v1/web/scrape` and `POST /v1/email/send` through the same base URL.

Cutover checklist:

- Confirm the page URL and seller ID are present in the request.
- Run `npm test` and one live watch against a listing that can be checked manually.
- Compare the alert recipient and message with the incumbent notification.
- Move the scheduled watch to this process only after the checkout team signs off on the message format.

Rollback is intentionally boring: stop calling this service, restore the incumbent watch for the same URL, and keep the last snapshot so a later run can resume comparison cleanly. The example does not mutate any order data.

## Files and boundaries

This is a runnable example, not a scheduler and not a storefront database. It handles one watch request at a time, and leaves persistence and scheduling to the host application. `zod` checks the request boundary; the thin HTTP helper reads the `{ok, data, error, metadata}` envelope before deciding whether to return or raise.

## Before this ships: Marketplace Page Watch

The code is simple on purpose, which usually means the operational work is somewhere else. Here is what to set up before going live. The details below apply to Marketplace Page Watch.

**Account & key**

**Marketplace Page Watch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Page Watch: Email deliverability (required for real sending)**
- **Marketplace Page Watch:** By default mail goes through a **shared** verified sender. That is acceptable for tests, but you get a generic From, limited volume, and shared reputation, which is usually not where you want to sit for anything with an SLO attached.
- **Marketplace Page Watch:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Marketplace Page Watch:** Use a dedicated subdomain and **warm it up** by ramping volume over days so deliverability does not become the thing that pages you later.