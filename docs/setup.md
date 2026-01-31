# Developer Setup (Supported Toolchain)

## Supported Node.js Versions (Required)

This repository supports **Node.js LTS only**:
- **20.x LTS**
- **22.x LTS**

Node “current” releases (for example 23.x/24.x/25.x) are not supported and may break tooling (Vitest, coverage, ESM loaders).

## Package Manager (Required)

This repo uses **pnpm via Corepack** (see `package.json` `packageManager`).

From the repo root:

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Windows: Switching Node Versions

Use one of:
- `fnm` (Fast Node Manager)
- `nvm-windows`

After switching to Node 22 LTS (or 20 LTS), re-run the install commands above.

## Verification Commands

```bash
npm run typecheck
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run test:integration
```

