# Closer to Korea — Data-Driven Weekly Curation

This project separates protected design/application code from weekly content data.

## Weekly editing workflow

For normal weekly updates, edit the complete private editorial master outside this repository. Keep draft media beside that source. Generate the public `data/` files using the allowlisted exporter, and copy only media referenced by published content.

Follow `CONTENT_MANAGER_GUIDE.md` for restore, editing, source validation, export, and publication. Public JSON is a reduced export, never an authoritative editing source.

Do not edit HTML, CSS, JavaScript, fonts, animation, design tokens, navigation behavior, card markup, filters, or accessibility logic during content updates.

Read `CONTENT_UPDATE_RULES.md` before adding content.

## Data files

### `data/products.json`

Automatically powers:

- Newly Added
- Trending in Korea
- full product guide
- product search
- category filters
- match-type filters
- verification filters
- status filters
- sorting
- generic product detail pages

Product detail URL:

```text
product.html?slug=product-slug
```

### `data/articles.json`

Automatically powers:

- Latest Guides
- guide cards
- generic article detail pages
- related products

Article detail URL:

```text
article.html?slug=article-slug
```

### `data/categories.json`

Protected configuration for:

- category labels
- category order
- curation filters
- product match labels
- verification options
- trend-status vocabulary

This is not part of the normal weekly workflow.

### `data/site-copy.json`

Protected configuration for:

- site name and permanent brand copy
- navigation
- hero copy
- ticker text
- section labels
- product-card labels
- curator, disclosure, newsletter, and footer copy

This is not part of the normal weekly workflow.

## Run locally

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Opening HTML directly with `file://` will prevent JSON fetch requests from working.

## Validate content

```bash
node scripts/validate-content.mjs --source /absolute/private/path/closer-to-korea-editorial-master.json
node scripts/validate-public-boundary.mjs
node scripts/validate-content.mjs
```

The validator checks:

- required fields
- duplicate IDs and article slugs
- category keys
- product match types
- trend statuses
- date format
- image paths
- related product references
- contradictory Personally Used labels
- HTTPS affiliate URLs

## Protected design identity

The following remain in protected code:

- Bagel Fat One display font
- DM Sans body font
- icy blue, lilac, pink, and pearl design tokens
- cursor sparkle effect
- moving ticker
- glossy translucent cards
- jelly buttons
- bead-style category controls
- responsive layouts
- reduced-motion behavior
- menu focus trap and scroll lock
- Amazon link attributes and disclosure behavior

## Amazon links

Keep `amazonUrl` and `affiliateUrl` empty until verified.

Active affiliate URLs automatically:

- open in a new tab
- use `rel="sponsored nofollow noopener"`
- expose a click event hook through the `affiliate-click` custom event

Do not show a fixed Amazon price unless it comes from a maintained, compliant source.

## Publishing flags

Products:

- `draft: true` — excluded from newly generated public data; does not erase old files or Git history
- `hidden: true` — excluded from newly generated public data; existing static pages require a reviewed removal
- `newlyAdded: true` — included in Newly Added
- `featured: true` — prioritized in recommended order
- `soldOut: true` — disables Amazon CTA

Articles:

- `draft: true` — excluded from newly generated public data; does not erase old files or Git history
- `featured: true` — prioritized in Latest Guides

## Launch and monetization readiness

Current site infrastructure:

- production domain: `https://closertokorea.com`
- canonical, sitemap, robots, and Open Graph URLs use the production domain
- a 1200 × 630 PNG social-card fallback is available for pages without an article image
- public content cannot use development placeholder SVGs; draft-only placeholder assets may remain until that content is ready
- Amazon Associates URLs and tracking tags remain empty until they are verified and the Amazon monetization layer is intentionally enabled
- AdSense connection and manual ad units remain disabled until the appropriate application/approval stage

Before a monetization application or major public launch, re-check the current curator/contact information and the applicable FTC, Amazon Associates, privacy, analytics, advertising, and consent requirements.


## Visual content manager

Open:

```text
admin.html
```

Use the manager to add and edit products and articles through forms. The manager requires an explicitly loaded complete private master. Manual exports contain public-only JSON and the generated fallback bundle. The local workflow saves the private source first, validates it, then prepares and stages only explicit public files. Archiving is not a privacy erasure and does not automatically delete an existing static page or past Git history.

See:

```text
CONTENT_MANAGER_GUIDE.md
```
