# cleared: the website

The product page for cleared. It is a separate Next.js project from the MCP server in the repository root, with its own dependencies and build. Deploy it as its own Vercel project with the root directory set to `marketing`.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm check    # route types, typecheck, lint, production build
```

## Checks

The checks run in a real browser against a production build. Headless Chromium on a Mac uses the real GPU.

```bash
pnpm build && pnpm start -p 3310
node tests/overlap.mjs  http://localhost:3310   # no overlapping, clipped or hidden text in any held frame
node tests/card.mjs     http://localhost:3310 2 # a card and its sheet: focus, paging, closing, layout
node tests/contrast.mjs http://localhost:3310   # every run of text against the pixels behind it
node tests/axe.mjs      http://localhost:3310   # accessibility, static page and film
node tests/perf.mjs     http://localhost:3310 --profile=phone
node tests/shots.mjs    http://localhost:3310 ./shots --gpu
```

Pass `--app=muse` to `overlap`, `contrast` and `shots` to check the page with the switch set to Muse.

## Layout

```text
app/                the page, the static (reduced-motion) version, metadata
components/stage/   the 3D stage: director, set, phone, screens, post-processing
lib/copy.ts         every word on the page
data/pool.json      snapshot of the company pool (pnpm pool:refresh)
brand/              third-party marks and where they came from
```

Company names, logos and app marks are trademarks of their owners. See [brand/README.md](brand/README.md).
