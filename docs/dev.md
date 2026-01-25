### WSL / Cross-platform installs (Windows + WSL)

Do not reuse `node_modules` between Windows and WSL/Linux. If you installed dependencies on Windows and then run the project inside WSL, Vitest/Rollup may fail because only Windows native binaries are present.

#### Symptoms
- WSL fails to resolve `@rollup/rollup-linux-x64-gnu`
- Vitest crashes during startup / bundling

#### Fix / Recommended workflow
- Run a fresh install per environment:
  - In WSL/Linux: remove `node_modules` and reinstall
    - `rm -rf node_modules`
    - `pnpm install --frozen-lockfile`
- We pin the Linux Rollup native package to prevent missing-binary issues:
  - `@rollup/rollup-linux-x64-gnu@4.55.1` is included in `devDependencies`.

#### Automatic version bumps
On pull requests, the CI pipeline bumps `package.json`'s patch version via Corepack/pnpm before the version-check step, so contributors do not need to update the version manually.

#### Verification
- `node -p "process.platform"` should print `linux` in WSL
- `pnpm run test` should pass
