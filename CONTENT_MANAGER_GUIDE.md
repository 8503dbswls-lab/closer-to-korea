# Content manager: private source, public exports

The complete editable source is a private editorial master. It contains published content, drafts, and editorial evidence. It must remain outside the public Git repository and webroot. A draft checkbox is not an access control.

The files under `data/` are generated public exports, not the complete editing source. Never restore the master from those reduced exports. Existing public Git history is not erased by this separation.

## Restore the full source

1. Download your latest private editorial backup to a private folder outside the site checkout.
2. Extract the archive there. It contains the editable `closer-to-korea-editorial-master.json`, assets, and restore instructions. Keep any `<master-path>.assets` sidecar folder with the master; it holds locally saved draft photos.
3. Keep a verified backup before replacing or moving any source. Do not commit or serve the master, its backups, or raw import payloads.
4. Set `CTK_EDITORIAL_MASTER` to the absolute path of the extracted JSON before starting the local content manager. For example, a private sibling folder is suitable; a folder inside the repository is not.
5. Run `node scripts/local-admin-server.mjs`, then open the local address it prints. The local manager loads the complete master through its token-protected local endpoint. The public hosted admin cannot fetch this private source.

Alternatively, explicitly import the complete master in the manager. Importing separate public products/articles exports does not establish a complete master. The manager must not silently treat those files, an old browser cache, or the public fallback bundle as a full source.

## Edit without losing drafts

- Save the full private master after edits. Local saves use a digest to reject stale edits and retain a prior copy outside the repository.
- Existing IDs cannot silently disappear from a save. Mark an item as a draft instead of deleting its source record.
- Browser working copies are temporary conveniences, not durable backups.
- A full private backup includes unpublished records and evidence. Do not upload it to the site or a public repository.
- When keeping the master in private file storage, replace the same private file with the latest version after edits and verify the saved copy. Keep its access private.

## Public exports

Public product, article, and fallback downloads use the same recursive allowlist. They include only records with `draft: false` and not `hidden: true`. Unknown publication flags are rejected; missing flags never make an item public.

Only approved public display/search fields are exported. Editorial source evidence, private notes, and draft records stay in the master. Existing public search aliases are limited to published IDs. Private keyword plans and draft text are not turned into search aliases.

To export locally without modifying the source:

```sh
node scripts/export-public-content.mjs --source /absolute/private/path/closer-to-korea-editorial-master.json
```

This writes `data/products.json`, `data/articles.json`, `data/search-aliases.json`, and `data/content-data.js`, plus their matching public category, site-copy, and monetization configuration. Rebuilding the fallback from existing public JSON is permitted only after the public boundary check; it never updates the full source.

## Images and article pages

Keep unpublished assets with the private source. Copy only images referenced by published records into the public assets folder. Public galleries, card images, hero images, and body images count as references.

Archiving a record excludes it from new public exports, but does not make a previously published URL or Git history private. Existing static pages require an explicit reviewed removal; the boundary check blocks a stale article page rather than silently deleting it.

Static article HTML still needs its existing article builder or the approved S3B importer. S3B requires the complete external master and keeps backups outside the checkout. Raw S3A payloads must also remain outside the public checkout. S3B does not push automatically.

## Validate and publish

```sh
node scripts/test-public-content.mjs
node scripts/test-editorial-source.mjs
node scripts/test-private-authoring-flow.mjs
node scripts/validate-public-boundary.mjs
node scripts/validate-content.mjs --source /absolute/private/path/closer-to-korea-editorial-master.json
node scripts/validate-content.mjs
node scripts/test-search-metadata.mjs
```

Source validation retains evidence, image-rights, source-policy, and editorial checks. The local publisher uses `--source ... --evidence-only` before export so old generated pages do not reject a new source record. Full public deployment validation still runs after generation; the evidence-only option is not allowed without a private source. Public validation checks the fields actually shipped. They are different checks, not substitutes for one another. Resolve new errors before publication; report any preexisting failures separately.

The local publisher requires a complete validated master, preserves it first, exports public-only data, and stages only known generated public files and referenced images. It must never stage everything indiscriminately. A failed publication does not delete the private master or its backup.

Review the staged diff, previews, canonical metadata, listing links, sitemap, and the exact deployment commit. Publishing a source change does not itself prove the live site has updated.

The guardrails cover the supported exporters and publishers. They cannot make a public Git repository private or undo an arbitrary manual commit. Review staged files before every push, and never commit a private source archive.
