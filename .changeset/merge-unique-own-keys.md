---
"@spa-kit/utils": patch
---

mergeUniqueOrThrow now compares exactly the keys a spread copies: shared symbol keys are detected as duplicates instead of silently overwritten, and keys the first object merely inherits (e.g. `toString`) no longer count as duplicates