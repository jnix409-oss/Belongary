# Belongary — brand assets for belongary.netlify.app

Drop this whole `brand/` folder into your site's **`public/`** directory
(Astro/Next/Vite all serve `public/*` at the site root). Files will then live at
`https://belongary.netlify.app/brand/...`

## 1. Replace the current logo

The header currently loads `/logo.png`. Swap it for the real wordmark:

```html
<a href="/" class="brand">
  <img src="/brand/logo-wordmark.png" alt="Belongary" height="36">
</a>
```
Use `logo-wordmark.png` when the word "Belongary" is NOT next to it in text.
Use `icon-512.png` (the arch mark alone) when it is.

## 2. Favicon + social preview — paste into <head> on every page

```html
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
<meta name="theme-color" content="#2B1B33">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Belongary">
<meta property="og:title" content="See if you'll belong — before you work there.">
<meta property="og:description" content="Belonging at work, filtered through the identity lenses that matter to you.">
<meta property="og:url" content="https://belongary.netlify.app/">
<meta property="og:image" content="https://belongary.netlify.app/brand/social/og-image-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://belongary.netlify.app/brand/social/og-image-1200x630.png">
```
og:image **must** be an absolute URL. Once live, re-scrape at
developers.facebook.com/tools/debug and linkedin.com/post-inspector.

## 3. Swap the emoji dimension icons

Company pages currently use 🤝 👁️ 🙌 📈 etc. Those read as generic and they
render differently on every OS. Use the brand icons instead — they inherit
`currentColor`, so they take your text colour automatically.

| Dimension                 | File                          |
|---------------------------|-------------------------------|
| Belonging & Inclusion     | `icons/belonging.svg`         |
| Feeling Heard / Seen      | `icons/feedback.svg`          |
| Manager Support           | `icons/manager-support.svg`   |
| Sponsorship & Access      | `icons/safe-to-speak.svg`     |
| Promotion Fairness        | `icons/fairness.svg`          |
| Growth & Mobility         | `icons/career-growth.svg`     |
| Representation            | `icons/learning.svg`          |
| Flexibility & Autonomy    | `icons/flexibility.svg`       |

Spare: `verified.svg` (verified-reviewer badge), `recognition.svg` (Index badge).

```html
<img src="/brand/icons/belonging.svg" alt="" width="24" height="24" class="dim-icon">
```
Or inline the SVG to colour it: `.dim-icon { color: #E4572E; }`

## 4. Other files

- `social/linkedin-banner-1584x396.png` — LinkedIn company page cover
- `social/avatar-1080.png` — profile picture, all platforms
- `social/quote-card-averages.png` — ready-to-post seeding graphic
- `social/hero-square-1080.png` — Instagram / launch post
- `pattern-elements.png` — decorative arch, venn, dot-grid, bars
