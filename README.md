# Brisbane TVs - Website

> **Current production setup:** Cloudflare Pages builds the site from the
> `astro/` directory with `npm run build`. The homepage is hand-authored HTML
> at `astro/public/index.html`; Astro pre-renders the rest of the public site
> to static HTML. The older root-level workflow below is retained as project
> history and should not be used for production deployments.

Professional TV wall mounting and Starlink installation service for North Brisbane.

**Live site:** Hosted via Cloudflare Pages  
**Repo:** [github.com/PrompDev/brisbanetvs](https://github.com/PrompDev/brisbanetvs)


## How This System Works

This paragraph describes the legacy root-level site. Current production uses
the Astro build described in the notice above.

The site is hosted on **Cloudflare Pages**, connected to this GitHub repo. When changes are pushed to the `main` branch, Cloudflare automatically picks them up and deploys the updated site to the live domain.

The workflow is: **edit locally -> preview in browser -> push to GitHub -> Cloudflare deploys automatically**.


## Prerequisites

Before you start, make sure you have the following installed on your PC:

1. **Git** - [Download here](https://git-scm.com/downloads) (used to sync code with GitHub)
2. **Node.js** - [Download here](https://nodejs.org/) (used to run the local dev server)
3. **GitHub access** - You need to be added as a collaborator on the repo


## Getting Started (First Time Setup)

1. Open a terminal (PowerShell on Windows, Terminal on Mac)
2. Navigate to where you want to store the project:
   ```
   cd Desktop
   ```
3. Clone the repository:
   ```
   git clone https://github.com/PrompDev/brisbanetvs.git
   ```
4. Navigate into the project folder:
   ```
   cd brisbanetvs
   ```
5. Install the dev server (one-time):
   ```
   npm install -g live-server
   ```
6. Start the dev server:
   ```
   live-server
   ```
   Your browser will open automatically at `http://127.0.0.1:8080` showing the site.


## Quick-Start Tools (Windows)

Inside the `git.tools` folder there are three batch files you can double-click to run common tasks without typing commands:

| File | What it does |
|---|---|
| `sync-from-main.bat` | Pulls the latest code from GitHub so your local copy is up to date |
| `start-dev-server.bat` | Launches the local dev server with auto-refresh in your browser |
| `update-main.bat` | Stages your changes, asks for a commit message, and pushes to GitHub |


## Day-to-Day Workflow

1. **Double-click** `git.tools/sync-from-main.bat` to make sure you have the latest version
2. **Double-click** `git.tools/start-dev-server.bat` to preview the site locally
3. **Edit** any HTML or CSS file in your code editor - the browser auto-refreshes on save
4. When you are happy with your changes, **double-click** `git.tools/update-main.bat`
5. Enter a short description of what you changed (e.g. "Updated phone number on homepage")
6. The changes are pushed to GitHub and Cloudflare deploys them to the live site


## Project Structure

```
brisbanetvs/
  index.html            <- Homepage
  about.html            <- About Us page
  services.html         <- Services and FAQ page
  book.html             <- Booking page
  [suburb].html          <- Area-specific landing pages (aspley, kedron, etc.)
  css/style.css          <- All site styles
  img/                   <- Site images
  generate-areas.js      <- Script used to generate area pages
  git.tools/             <- Windows batch files for common tasks
  README.md              <- This file
```


## Notes

- **Email:** Email routing still needs to be connected back to SiteGround to send/receive emails.
- **DNS/Hosting:** Domain and DNS are managed through Cloudflare.
- **Legacy root files:** These are plain HTML/CSS; production is built from `astro/`.

## Official Meta Lead Ads intake

The production lead Worker has a signed Meta Page webhook at:

`https://brisbanetvs.com/api/meta-lead-webhook`

It verifies Meta's `X-Hub-Signature-256`, queues only lead object IDs in D1,
fetches the lead through Graph API, deduplicates by `leadgen_id`, and reuses the
normal Google Sheet and Calendar delivery ledger. A two-minute Worker heartbeat
feeds the existing `Runs` monitor; zero new leads is `OK`, while exhausted Graph
or Sheet delivery failures are `ERROR`.

Activation requires these Worker secrets:

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_PAGE_ACCESS_TOKEN`

The Graph version is configured with `META_GRAPH_API_VERSION`. Production intake
was activated on 15 July 2026 after a signed Meta test lead completed the full
Meta -> Worker -> Sheet delivery path with phone and email present. Keep
`META_MONITOR_ENABLED = "true"` so the monitor runs its grey two-minute checks,
orange 30-minute blocks, purple hourly blocks, and blue daily rollups. A value of
`"false"` is only for deliberate maintenance while the Page subscription or
credentials are unavailable.
