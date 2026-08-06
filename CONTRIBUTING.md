# Contributing to Belongary

## Data Integrity Guard

The build pipeline includes a mandatory check (`scripts/check-no-fabricated-data.mjs`) that
**fails the build** if any company in `src/data/companies.json` has `reviewCount > 0` while
its `reviews` array is empty.

### Why this exists

Belongary displays belonging scores for real, named employers. Shipping fabricated review
counts, scores, or rankings alongside real company names is a legal and trust liability —
it misrepresents the experiences of real workers at real organizations. This guard ensures
that aggregate numbers can only exist when backed by actual review records.

### What it checks

| Condition | Result |
|---|---|
| `reviewCount > 0` and `reviews` is empty | **Build fails** |
| `reviewCount` ≠ `reviews.length` | **Build fails** |
| `reviewCount === 0` and `reviews` is empty | ✅ Pass |
| `reviewCount === reviews.length` (both > 0) | ✅ Pass |

### How to add a company

Add a shell record with `reviewCount: 0` and `reviews: []`. Scores will appear
automatically once real reviews bring the count above the display threshold
(defined in `src/config.ts`).

```json
{
  "slug": "company-name",
  "name": "Company Name",
  "industry": "Industry",
  "hq_metro": "Metro Area",
  "reviewCount": 0,
  "reviews": []
}
```
