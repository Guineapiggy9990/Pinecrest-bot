---
name: Workspace package installs
description: How to add runtime dependencies without accidentally targeting the pnpm workspace root.
---

Use the package manager with the target workspace filter when adding a dependency to a monorepo package.

**Why:** The generic package installer targets the workspace root by default and pnpm blocks that operation unless explicitly overridden.

**How to apply:** For a package owned by a workspace member, use the member filter and keep runtime dependencies in `dependencies`, not only `devDependencies`.