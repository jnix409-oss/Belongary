# Belongary

Real talk about belonging at work — filtered through identity lenses that matter.

## What It Is

Belongary shows whether people actually belong at a company — filtered through their own identity lens — using one honest headline question plus eight structured dimensions, self-reported and anonymous.

## Stack

- **Astro** — static site generator
- **Tailwind CSS** — utility-first styling with custom design tokens
- **Netlify** — hosting + form handling (no backend)
- **Fraunces** + **Inter** — brand fonts

## Quick Start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output → dist/
npm run preview    # preview production build
```

## Project Structure

```
src/
  data/
    companies.json        # seed company data (hand-editable)
    lenses.ts             # identity lens definitions
    dimensions.ts         # 8 belonging dimensions
    thresholds.ts         # suppression logic + score helpers
  layouts/
    BaseLayout.astro      # site shell (head + header + footer)
    LegalLayout.astro     # narrow prose layout for legal pages
  components/
    Header.astro          # site navigation
    Footer.astro          # footer links
  pages/
    index.astro           # home page
    review.astro          # review submission form
    company/[slug].astro  # company profiles with lens toggle
    directory/            # ranked company lists
    methodology.astro     # how it works
    guidelines.astro      # community guidelines
    dispute.astro         # dispute process
    terms.astro           # terms of service (draft)
    privacy.astro         # privacy policy (draft)
    about.astro           # founder story
```

## Company Data

All company data lives in `src/data/companies.json`. This file is designed to be hand-edited as you moderate submissions manually.

Each company entry follows this shape:

```json
{
  "slug": "company-name",
  "name": "Company Name",
  "industry": "Industry",
  "hq_metro": "City",
  "reports": {
    "n": 100,
    "yes": 65, "no": 15, "depends": 20,
    "dimensions": { "belonging": 4.0, ... },
    "by_lens": {
      "poc": { "n": 30, "yes": 55, "no": 20, "depends": 25, "dimensions": { ... } }
    }
  }
}
```

**Headline percentages:** `yes`, `no`, `depends` are stored as integers that sum to 100 (percentages of total responses for that question). The headline score displayed on the site is `yes ÷ (yes + no) × 100`.

**Suppression thresholds:**
- `n < 5` — scores hidden ("not enough reports yet, currently at N")
- `n: 5–24` — shown with "Early / Small Sample" label
- `n: 25–99` — shown with "Directional" label
- `n ≥ 100` — shown with "Reliable" label

Thresholds apply **per lens, per dimension**.

## Forms

Two Netlify Forms are configured:

1. **`waitlist`** — email capture on the home page
2. **`review`** — full review submission form

Both use honeypot fields for spam protection. Form submissions appear in the Netlify admin dashboard for manual moderation.

## Deploy

Push to the connected Netlify site — `npm run build` produces static HTML in `dist/`.

Redirects in `netlify.toml` map `/index` → `/directory/` and `/index/:lens` → `/directory/:lens/` to handle the spec's routing requirements.
