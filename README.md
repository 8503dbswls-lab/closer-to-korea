# Closer to Korea — Data-Driven Weekly Curation

This project separates protected design/application code from weekly content data.

## Weekly editing workflow

For normal weekly updates, edit only:

- `data/products.json`
- `data/articles.json`
- `assets/images/`

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

- `draft: true` — never public
- `hidden: true` — temporarily removed
- `newlyAdded: true` — included in Newly Added
- `featured: true` — prioritized in recommended order
- `soldOut: true` — disables Amazon CTA

Articles:

- `draft: true` — never public
- `featured: true` — prioritized in Latest Guides

## Before launch

- replace placeholder SVGs with original or properly licensed photography
- add verified Amazon Associates URLs and tracking tags
- add the approved curator biography and contact information
- confirm the production domain used in canonical, sitemap, robots, and OG URLs
- create a dedicated 1200 × 630 Open Graph image
- review FTC, Amazon Associates, privacy, analytics, and email-consent requirements


## Visual content manager

Open:

```text
admin.html
```

Use the manager to add and edit products and articles through forms, then export the replacement JSON and fallback data bundles.

See:

```text
CONTENT_MANAGER_GUIDE.md
```
