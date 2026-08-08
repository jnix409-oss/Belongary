# Restoring Company Pages

Company profile pages and the company directory were removed in commit
`d2221ec` to eliminate empty employer-named pages that rendered no content.
The routes, data, and components are designed to be restored once the
preconditions below are met.

## Files to restore

| File | Location | Source |
|---|---|---|
| `src/pages/company/[slug].astro` | `src/pages/company/` | Retrieve from commit `bfa8f67` (parent of removal) |
| `src/pages/directory/index.astro` | `src/pages/directory/` | Retrieve from commit `bfa8f67` |
| `src/pages/directory/[lens].astro` | `src/pages/directory/` | Retrieve from commit `bfa8f67` |

## Files already in the repo (preserved, not deleted)

These survived the removal and are ready to use:

- `src/components/ReviewProgress.astro` — progress bar component (currently orphaned)
- `src/data/companies.json` — 26 company records with `slug`, `name`, `industry`, `hq_metro`, `featured`, `reviewCount`, `reviews`
- `src/data/lenses.ts` — 11 identity lenses + `getLensLabel()`
- `src/data/dimensions.ts` — 8 belonging dimensions
- `src/data/thresholds.ts` — `hasThreshold()`, `getThreshold()`, `getScoreColor()`, `getScoreLabel()`, `getHeadlineBadge()`
- `src/config.ts` — `MIN_REVIEWS_DISPLAY = 5`, `MIN_REVIEWS_SENSITIVE_LENS = 8`

## What must be added before restoring

1. **Disclosure Transparency section** — company pages need a section explaining
   how scores are calculated, what thresholds apply, and how reviews are moderated.

2. **Real threshold states wired to `hasThreshold()`** — the company page must
   correctly gate score display behind `hasThreshold(reviewCount)` and show the
   `ReviewProgress` component when below threshold. The removed page already did
   this, but verify it still works with any data-shape changes.

3. **Link to `/dispute`** — every company page must include a visible link to the
   dispute process so employers know how to challenge factual accuracy.

## Precondition

**Do not restore a company page until that company has ≥ `MIN_REVIEWS_DISPLAY`
(currently 5) real, moderated reviews.** Below that threshold the page shows
nothing useful and exposes an employer-named URL with no content.

## When restoring

1. Retrieve the three page files from commit `bfa8f67`:
   ```bash
   git show bfa8f67:src/pages/company/\[slug\].astro > src/pages/company/\[slug\].astro
   git show bfa8f67:src/pages/directory/index.astro > src/pages/directory/index.astro
   git show bfa8f67:src/pages/directory/\[lens\].astro > src/pages/directory/\[lens\].astro
   ```

2. Add the Disclosure Transparency section and `/dispute` link to `company/[slug].astro`.

3. Re-add nav links if appropriate (Header.astro, homepage grid, etc.).

4. Remove or update the 301 redirects in `netlify.toml` for `/company/*`,
   `/directory`, and `/directory/*`.

5. Consider adding `@astrojs/sitemap` and restoring the `Sitemap:` line in
   `robots.txt`.

6. Build and verify: company pages render correctly, threshold gating works,
   no 404s introduced.
