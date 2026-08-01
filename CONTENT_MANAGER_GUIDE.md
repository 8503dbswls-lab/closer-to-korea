# CONTENT MANAGER GUIDE

The project now includes a visual content editor:

```text
admin.html
```

It is a local administration tool and is not linked from the public website.

## Open the manager

You can open `admin.html` directly from the project folder.

For the most reliable preview, run:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/admin.html
```

## What the manager edits

### Products

The form supports:

- ID and slug
- product name and summary
- category and tags
- image path, alt text, and image status
- Korean-life context
- direct-use and safety notes
- Product Match
- Verification states
- trend status
- brand and model evidence
- Amazon and affiliate URLs
- publication dates and flags

### Articles

The form supports:

- ID, slug, title, SEO title, and meta description
- category and tags
- hero image, alt, caption, width, and height
- body blocks
- related products
- sources and source requirement
- published and updated dates
- featured and draft flags

Article block types:

- paragraph
- heading
- list
- quote
- image
- definition list

## Browser working copy

The **Save draft in browser** button saves the current working copy to local browser storage.

This is useful while editing, but it is not a replacement for exporting files and backing them up.

## Export files

On the **Export & publish** tab, download:

```text
products.json
articles.json
content-data.js
content-data-v2.js
```

Replace the corresponding files in:

```text
data/
```

New images must still be copied into:

```text
assets/images/
```

## Why two content-data files exist

The current project includes two fallback bundles because an earlier article-cache fix introduced `content-data-v2.js`.

Both bundles should contain the same product and article data.

The manager exports both formats.

## Validate before publishing

Use the manager’s browser validation first.

Then run the full project validator:

```bash
node scripts/validate-content.mjs
```

The Node validator remains the final authority because it can also verify file paths inside the project.

## Important publishing rules

- Keep incomplete products and articles as drafts.
- Do not enable an active purchase CTA without a verified affiliate URL.
- Do not mark a product Personally Used unless it was directly used.
- Do not mark a product Confirmed Match without brand, model, evidence, and sources.
- Add accurate image alt text.
- Add article sources when `sourceRequirement` is `required`.
- Export and replace both data bundles after every change.
