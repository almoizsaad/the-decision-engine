# Deployment

This is a static Vite build with no backend and no environment variables — any static host
works. Two of the fastest options:

## Option A — Vercel (recommended, ~2 minutes)

```bash
npm install -g vercel   # if you don't already have it
vercel login
vercel --prod
```

Accept the defaults (Vercel auto-detects Vite: build command `npm run build`, output directory
`dist`). Copy the URL it prints into the **Live demo URL** field of the submission form and into
the placeholder at the top of `README.md`.

Or without the CLI: push this repo to GitHub, go to vercel.com → "Add New Project" → import the
repo → deploy with the defaults.

## Option B — Netlify

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist
```

## Verifying the build locally first

```bash
npm run build
npm run preview   # serves the production build at http://localhost:4173
```

If `npm run preview` shows a working queue with all four domains, the deployed version will too
— there's no server-side piece that could behave differently in production.

## Loom script

The brief asks for a 90-second walkthrough. A tight script that shows the core mechanic without
padding:

1. **(0:00–0:15)** Open on the ticket-triage queue. Click the top item. Point at the outcome
   badge, confidence, and risk numbers together — "one number for how sure it is, one for how
   bad it'd be to be wrong."
2. **(0:15–0:35)** Expand the signal trace. Point at one confidence signal and one risk signal,
   read their one-line rationale out loud.
3. **(0:35–0:50)** Switch to a queue item that lands on `ask` or `escalate` instead of `execute`
   — point at the evidence-used vs. missing-information columns and the reversibility strip.
4. **(0:50–1:05)** Click **"Run the failure case."** Select it. Read the description of what's
   actually wrong, then point out that the engine still gave a confident, wrong-looking answer
   (or, for the content-moderation domain, that "ask" doesn't save it either) — that's the point.
5. **(1:05–1:20)** Click **"This wasn't the right call"** on any decision, then re-open the
   signal trace and point at the "weight adjusted" tag and the banner under the domain
   description.
6. **(1:20–1:30)** Scroll to the audit trail, expand one row, show the JSON.

Once recorded, add the Loom link to the submission form's video field.
