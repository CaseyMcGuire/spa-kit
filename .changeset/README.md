# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

When you make a change to a package that should be released, run:

```bash
npm run changeset
```

Answer the prompts to record which packages changed and at what semver bump.
This writes a markdown file into this folder describing the change.

To release:

```bash
npm run version-packages   # consumes changesets, bumps versions + changelogs
npm run release            # builds and publishes changed packages to npm
```