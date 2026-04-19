# 05 · Git tools

Every `.bat` file in `git.tools/`, what it does, when to use it, and
what goes wrong.

## When to use what

```
Start of a work session  →  sync-from-main.bat      (pull any changes you missed)
During work (homepage)   →  start-dev-server.bat    (preview marketing homepage)
During work (blog)       →  start-astro-dev.bat     (preview blog + /admin)
End of a work session    →  update-main.bat         (commit + push everything)
```

## `sync-from-main.bat`

**Run this first**, every time you sit down to work. Especially if
you've been using the CMS at `/admin/` or if someone else has pushed.

- Fetches the latest from GitHub.
- Pulls it into your local copy.
- Fails loudly if you have local changes that would conflict — in
  that case the script prints what to do.

## `start-dev-server.bat`

Starts a live-reloading preview of the marketing homepage
(`index.html`). Installs `live-server` globally the first time
(requires Node.js). Opens at `http://127.0.0.1:8080`.

Use it for any edit to:

- `index.html`
- anything in `img/`
- anything in `css/`

## `start-astro-dev.bat`

Starts the Astro dev server for the blog. First run takes 30-60
seconds to install dependencies; subsequent runs are instant.

- Blog index: `http://localhost:4321/blog/`
- CMS admin:  `http://localhost:4321/admin/`
- Hot-reloads any `.astro`, `.md`, or `.css` save.

Use it for any edit to:

- anything in `astro/src/`
- anything in `astro/public/`
- a new blog post you're drafting

## `update-main.bat`

Stages everything you changed, commits with an auto-generated message
including a timestamp and file count, then pushes to `main`.

- Automatically writes a summary to `git.tools/CHANGELOG.log` with
  per-file line/char diffs.
- If the push fails (because someone else pushed first), it tells you
  to run `sync-from-main.bat` and try again.
- Never needs you to type a commit message — it makes one for you.

### Reading the CHANGELOG.log

Every push adds a block like:

```
----------------------------------------
[2026-04-19 14:32] 3 file(s) | commit: a1b2c3d
----------------------------------------
  Summary: 3 files changed, 45 insertions(+), 12 deletions(-)
  [+24/-5 lines] [+820/-110 chars]  index.html
  [+18/-2 lines] [+412/-38 chars]  astro/src/content/blog/new-post.md
  [+3/-5 lines] [+88/-62 chars]    astro/src/layouts/BaseLayout.astro
```

The commit hash (e.g. `a1b2c3d`) is a shortcut you can give to Claude
or paste into the GitHub UI to jump straight to that change.

## Troubleshooting

### "'git' is not recognized…"

Git isn't installed or isn't on your PATH. Install from
<https://git-scm.com/download/win>.

### "Push rejected (non-fast-forward)"

Someone pushed to `main` since your last sync. Run
`sync-from-main.bat`, then try `update-main.bat` again.

### "Merge conflict in …"

Two people edited the same line. `sync-from-main.bat` will stop and
leave conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in the file.
Open the file, pick which version you want, delete the markers, then
run `update-main.bat`.

### npm errors in `start-astro-dev.bat`

- **First time ever:** make sure Node.js LTS is installed
  (<https://nodejs.org>) and reboot your terminal.
- **After updating deps:** delete `astro/node_modules/` and
  `astro/package-lock.json`, then re-run the script.
