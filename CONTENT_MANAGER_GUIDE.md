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
```

Replace the corresponding files in:

```text
data/
```

For the manual export workflow, new images must also be copied into the project under:

```text
assets/images/
```

When using the local one-click workflow, JPG, PNG, and WebP files can instead be staged from the local admin. Only staged images that are actually referenced by the published Product or Article are copied into `assets/images/uploads/` and committed.

## Generated content fallback bundle

The current project uses one generated fallback bundle: `data/content-data.js`.

The visual manager exports this file together with `products.json` and `articles.json`. Replace the existing `data/content-data.js` when publishing an update.

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
- In the manual workflow, replace `products.json`, `articles.json`, and the single generated `content-data.js` bundle after every published change.

## Local one-click publish (Windows)

One-click publish is an optional local workflow. It is never enabled from the public `closertokorea.com/admin.html` page.

Requirements:

- Work from a real Git clone of the Closer to Korea repository, not a downloaded ZIP.
- Install Node.js and Git for Windows.
- Sign in to GitHub through Git Credential Manager (or another Git credential method supported by your PC). Never place a GitHub token inside HTML or JavaScript.
- Keep the Git working tree clean before publishing. If the local branch and `origin` are not synchronized, publishing is blocked.

Workflow:

1. Double-click `START_ADMIN_WINDOWS.bat`.
2. The admin opens on `http://127.0.0.1:8787/admin.html`.
3. Save the current Product or Article in the editor. The local Publish button also refuses to proceed if the current form has unsaved invalid changes.
4. Run browser validation, then use **Validate and publish to GitHub**.
5. The local bridge writes only `data/products.json` and `data/articles.json`, runs the existing deployment-preparation scripts, validates the full site, commits the generated changes, and pushes the current branch.
6. Any validation, commit, or push failure triggers a rollback to the pre-publish Git HEAD.

### Local image staging

While the local admin is running, JPG, PNG, and WebP images can be selected with **Stage new photos**. The local bridge verifies the actual file signature instead of trusting the filename or MIME label, creates a collision-resistant path under `assets/images/uploads/`, and keeps the staged file outside the Git working tree until publication.

Use the returned path as the Product image, Article hero image, or an Article body-image path. On a successful publish, only staged images referenced by the published data are copied into the project and committed. If validation or push fails, Git-side image copies are rolled back while the staged file remains available for a corrected retry during that local admin session.

The manual JSON download/export workflow remains available as a fallback. In the manual workflow, image files must already exist at the referenced project paths; missing images are blocked by the deployment validator.
