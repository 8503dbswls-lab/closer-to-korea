# CONTENT UPDATE RULES

This project separates protected design/application code from content data.

## Core operating principle

**Keep the current design unchanged. Correct and expand content through data files only.**

For normal weekly updates, edit only:

- `data/products.json`
- `data/articles.json`
- `assets/images/`

The following are controlled vocabulary and permanent copy files. Edit them only when the site owner intentionally changes the taxonomy or brand language:

- `data/categories.json`
- `data/site-copy.json`

Do not edit during routine content updates:

- CSS
- design tokens
- font imports or assignments
- common HTML layouts
- common browser JavaScript
- cursor sparkle logic
- ticker animation
- navigation
- product-card markup
- responsive styles
- accessibility behavior
- Amazon disclosure structure

Run the validator before every publication:

```bash
node scripts/validate-content.mjs
```

---

## 1. Official Product Match system

Product Match describes **how closely the Korean item and the linked or discussed product match**. It does not describe popularity, direct use, or category.

Only these four keys are allowed:

| Key | Display name | Definition |
|---|---|---|
| `confirmed` | Confirmed Match | Exact brand, product, and model or unique identifying information have been verified. |
| `likely` | Likely Match | The product appears identical or highly likely to match, but the exact model has not been fully confirmed. |
| `similar` | Similar Alternative | A different product with a similar use, form, or function. |
| `culture-inspired` | Korean Culture-Inspired Pick | Not the same product, but connected to Korean culture, daily life, or a Korean trend. |

Display names are centrally managed in `data/categories.json`.

A product should normally store the key:

```json
{
  "productMatchType": "likely"
}
```

The current data also stores `productMatchLabel` for compatibility. It must exactly match the central label. The validator rejects mismatched key/label pairs.

### Confirmed Match requirements

Use `confirmed` only when enough identifying evidence exists:

- brand
- model name, model number, product number, or other unique identifier
- official product page or reliable product information
- product markings, packaging, or a clearly documented comparison
- evidence that the Korean item and connected product are the same
- current `lastCheckedAt`

Recommended fields:

```json
{
  "brand": "Verified brand",
  "modelNumber": "Verified model or product number",
  "modelEvidence": "Description of the identification evidence",
  "sourceUrls": ["https://official-source.example/product"],
  "lastCheckedAt": "YYYY-MM-DD"
}
```

Do not use Confirmed Match for:

- a general product category
- a product that only looks similar
- an unidentified beauty puff
- a general portable fan
- a general study timer
- a household item without packaging or markings
- a product with no model, product number, or unique identifier

Use `likely`, `similar`, `culture-inspired`, or keep the product as a draft instead.

---

## 2. Official Verification system

Verification describes **how the site owner or editor checked the product or claim**.

Allowed keys:

| Key | Display name | Definition |
|---|---|---|
| `personally-used` | Personally Used | The site owner directly used the product. |
| `personally-photographed` | Personally Photographed | The site owner directly photographed the product. |
| `personally-purchased-in-korea` | Personally Purchased in Korea | The site owner directly purchased the product in Korea. |
| `seen-in-daily-life` | Seen in Korean Daily Life | Repeatedly observed in real Korean homes, schools, workplaces, or other daily-life settings. |
| `seen-in-store` | Seen in a Korean Store | Directly observed in an offline store in Korea. |
| `trend-verified` | Trend Verified | Current evidence supporting the product as a Korean trend has been checked. |
| `research-based` | Research-Based | Information comes from research rather than direct experience. |
| `model-unverified` | Exact Model Unverified | The form or product type appears to match, but the exact model has not been confirmed. |

Multiple statuses may be used when each is true.

Example:

```json
{
  "personallyUsed": true,
  "verificationStatus": [
    "personally-used",
    "personally-purchased-in-korea",
    "model-unverified"
  ],
  "verificationLabels": [
    "Personally Used",
    "Personally Purchased in Korea",
    "Exact Model Unverified"
  ]
}
```

Rules:

- Never add `personally-used` unless the owner directly used the product.
- `Personally Used` does not mean the exact Amazon model is confirmed.
- `Trend Verified` does not mean the product match is confirmed.
- A direct-use product may also have research, but should not be labeled only `research-based`.
- Do not add `seen-in-daily-life` merely because the owner owns one item. It requires repeated observation in broader daily-life settings.

---

## 3. Keep these concepts separate

| Data concept | What it means |
|---|---|
| Product Match | How closely the Korean item and connected product match |
| Verification | How the product or claim was checked |
| Trend Status | Whether the product is rising, trending, established, standard, fading, archived, or unclassified |
| Category | The editorial/product classification |

Example:

```json
{
  "productMatchType": "likely",
  "verificationStatus": [
    "personally-used",
    "personally-purchased-in-korea",
    "model-unverified"
  ],
  "trendStatus": "everyday-standard",
  "categoryKey": "food"
}
```

Do not use one concept as evidence for another.

---

## 4. Direct experience versus official product information

Personal experience must be stated as personal experience.

Acceptable:

> The owner has cleaned the item in a dishwasher without noticing a problem. However, the exact model’s official dishwasher-safe marking has not yet been verified.

Do not convert that statement into:

- officially dishwasher safe
- manufacturer approved for dishwashers
- safe at a specific temperature
- made from a specific material

Do not state exact cooking time, heat resistance, material, manufacturer, model number, current price, current inventory, or exact Amazon match until verified.

Use these optional fields to keep the distinction explicit:

```json
{
  "personalUseNotes": "Direct owner experience.",
  "safetyNotes": "Personal experience and official status clearly separated.",
  "modelEvidence": "What has and has not been compared."
}
```

---

## 5. Trend Status

Allowed values:

- `rising`
- `trending`
- `established`
- `everyday-standard`
- `fading`
- `archive`
- `""` for Unclassified

Do not mark a product Trending merely because it is personally used.

Use `trend-verified` in Verification only when current trend evidence has been checked.

---

## 6. Draft and public conditions

### Products

`draft: true` products must not appear in:

- homepage product lists
- Newly Added
- Trending
- search
- filters
- recommended products
- related products
- product detail pages
- structured data
- sitemap entries

Use `draft: false` only after checking:

- factual description
- Korean-life context
- Product Match
- Verification
- image permission/status
- image alt
- Amazon state
- `lastCheckedAt`
- sources where needed
- CTA consistency

A draft product should also have:

```json
{
  "featured": false,
  "newlyAdded": false,
  "activePurchaseCta": false
}
```

### Articles

`draft: true` articles must not appear in:

- Latest Guides
- article detail pages
- related content
- search
- structured data
- sitemap entries

A public article requires a complete title, excerpt, body, hero image alt, dates, and source policy.

---

## 7. Article source requirements

Every article must include:

```json
{
  "sourceRequirement": "required"
}
```

Allowed values:

- `required`: claims about trends, specifications, market conditions, safety, or external verification require sources
- `optional`: personal experience or essay-led content may have an empty source list
- `not-applicable`: policy, About, or operational content does not require sources

Rules:

- `required` + empty `sources` is an error
- `optional` may use an empty array
- `not-applicable` skips source checks

Personal experience may be written without an external source. Product specifications, official safety, current trends, price, inventory, and model identity require supporting evidence.

---

## 8. Amazon URL roles

- `amazonUrl`: original Amazon product URL
- `affiliateUrl`: public Amazon Associates URL containing the tracking tag

Example:

```json
{
  "amazonUrl": "",
  "affiliateUrl": "",
  "amazonAvailability": "under-review",
  "linkLastCheckedAt": "",
  "activePurchaseCta": false
}
```

Rules:

- `affiliateUrl` requires `linkLastCheckedAt`
- no `affiliateUrl` means no active purchase CTA
- `amazonAvailability: "under-review"` means the CTA stays disabled
- do not show `Available on Amazon US` without a valid public link
- `soldOut: true` disables the purchase CTA
- an unconfirmed product match must not be presented as Confirmed Match
- Amazon is an optional purchase path, not the site’s editorial identity

---

## 9. Image rules

Priority:

1. owner-shot product photos
2. owner-shot Korean daily-life context
3. properly licensed brand/product images
4. Amazon Associates-compliant images
5. original illustrations and development placeholders

Do not:

- download Amazon images and store them locally without permission
- use drama screenshots
- use idol photos
- use YouTube frames
- use social-media photos without permission

Every image needs accurate alt text.

Use `publicImageStatus`:

- `original-photo`
- `licensed`
- `amazon-compliant`
- `original-illustration`
- `placeholder`

A public product using a placeholder SVG receives a validator warning and must be reviewed before launch.

---

## 10. Add a weekly product

Edit only:

- `data/products.json`
- `assets/images/`

Checklist:

1. Create a unique `id` and preserve it forever.
2. Create a URL-safe `slug`.
3. Use an existing `categoryKey`.
4. Write a factual summary.
5. Explain where it appears in Korea.
6. Explain who uses it.
7. Explain why it matters.
8. Choose one official Product Match key.
9. Record only truthful Verification states.
10. Choose a supported Trend Status or leave it unclassified.
11. Add accurate image alt text.
12. Record image status and usage rights.
13. Keep Amazon links empty until verified.
14. Set `draft: true` while incomplete.
15. Run validation.
16. Preview on mobile and desktop.
17. Set `draft: false` only after all public conditions are met.

### Sample product

```json
{
  "id": "sample-product-id",
  "slug": "sample-product-id",
  "name": "Sample Product Name",
  "summary": "A factual description.",
  "categoryKey": "home-kitchen",
  "category": "Korean Home & Kitchen",
  "tags": ["home", "kitchen"],
  "image": "assets/images/sample-product.webp",
  "imageAlt": "Clear description of the product image",
  "seenInKorea": "Where this is seen in Korea.",
  "usedBy": "Who commonly uses it.",
  "whyItMatters": "Why it is useful, familiar, or relevant.",
  "koreanProductStatus": "What is known about the Korean product identity.",
  "productMatchType": "likely",
  "productMatchLabel": "Likely Match",
  "brand": "",
  "modelNumber": "",
  "modelEvidence": "Exact model not yet verified.",
  "sourceUrls": [],
  "usDifference": "An exact Amazon US match has not yet been confirmed.",
  "verificationStatus": ["research-based", "model-unverified"],
  "verificationLabels": ["Research-Based", "Exact Model Unverified"],
  "personallyUsed": false,
  "personalUseNotes": "",
  "safetyNotes": "",
  "amazonUrl": "",
  "affiliateUrl": "",
  "amazonAvailability": "under-review",
  "amazonLabel": "Amazon match under review",
  "linkLastCheckedAt": "",
  "activePurchaseCta": false,
  "publishedAt": "YYYY-MM-DD",
  "lastCheckedAt": "YYYY-MM-DD",
  "trendStatus": "",
  "trendLabel": "Unclassified",
  "featured": false,
  "newlyAdded": false,
  "soldOut": false,
  "draft": true,
  "hidden": false,
  "publicImageStatus": "placeholder",
  "cta": "View Product Details"
}
```

---

## 11. Add a weekly article

Edit only:

- `data/articles.json`
- `assets/images/`

### Sample article

```json
{
  "id": "sample-article-id",
  "slug": "sample-article-slug",
  "title": "Sample Article Title",
  "excerpt": "A concise factual description.",
  "body": [
    {
      "type": "paragraph",
      "text": "Opening paragraph."
    }
  ],
  "categoryKey": "home-kitchen",
  "tags": ["home", "daily life"],
  "heroImage": "assets/images/sample-article.webp",
  "heroImageAlt": "Clear description of the article image",
  "relatedProductIds": [],
  "sources": [],
  "sourceRequirement": "optional",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "featured": false,
  "draft": true
}
```

---

## 12. Validation and preview

Run:

```bash
node scripts/validate-content.mjs
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Confirm:

- validation has no errors
- warnings are reviewed
- draft items stay hidden
- match filters use the official four labels
- Amazon buttons match link state
- direct experience and official safety information remain separate
- search and sorting work
- mobile cards remain readable
- no browser console errors appear


## Article photography blocks

Articles may place licensed or owner-shot images inside the `body` array without editing HTML.

```json
{
  "type": "image",
  "src": "assets/images/articles/article-slug/photo.jpg",
  "alt": "Accurate description of the image",
  "caption": "Optional visible caption.",
  "width": 1800,
  "height": 1200
}
```

Use:

- an accurate `alt`
- the original image width and height
- an optional factual caption
- only original, licensed, or otherwise authorized images

The content validator checks that body-image files exist and that alt text is present.


## Direct-open preview support

This project includes `data/content-data.js` as a generated fallback so the site can display JSON content even when `index.html` is opened directly from a ZIP or local file.

After editing any JSON file, run:

```bash
node scripts/build-content-bundle.mjs
node scripts/validate-content.mjs
```

`data/content-data.js` is generated output. Do not edit it by hand.


## Visual content manager

For editors who do not want to edit JSON directly, open:

```text
admin.html
```

The visual manager edits an in-browser working copy and exports:

- `products.json`
- `articles.json`
- `content-data.js`
- `content-data-v2.js`

Read `CONTENT_MANAGER_GUIDE.md` for the complete workflow.

The manager does not modify CSS, HTML layout, fonts, animations, navigation, cards, search, filters, or accessibility behavior.
