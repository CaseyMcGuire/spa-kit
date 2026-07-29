# @spa-kit/utils

## 0.0.2

### Patch Changes

- 4cb3dd1: mergeUniqueOrThrow now compares exactly the keys a spread copies: shared symbol keys are detected as duplicates instead of silently overwritten, and keys the first object merely inherits (e.g. `toString`) no longer count as duplicates

## 0.0.1

### Patch Changes

- Initial public release.
