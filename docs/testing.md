# Testing Guide

This document defines the testing strategy for the AgentX repository, including the separation between unit and integration tests, folder structure, and commands.

## Package Manager: pnpm-first

**This repository uses pnpm as the primary package manager.**

- `packageManager`: "pnpm@9.12.3" (defined in package.json)
- Vitest is installed as a **devDependency**, not globally
- All test commands use `pnpm exec vitest` for Windows compatibility
- **Never call `vitest` directly** - it may not be in PATH on Windows

**Why `pnpm exec vitest`?**
- Ensures vitest is found in node_modules/.bin on all platforms
- Works reliably in PowerShell, cmd.exe, and bash/zsh
- Matches pnpm best practices for monorepo tooling

## Test Taxonomy (Milestone 1)

### Unit Tests
**Location:**
- `packages/**/src/__tests__/**/*.{test,spec}.{js,ts,tsx}`
- `packages/**/src/**/*.{test,spec}.{js,ts,tsx}` (colocated)

**Characteristics:**
- **Deterministic**: Same input always produces same output
- **Isolated**: No external dependencies (network, filesystem, database)
- **Fast**: Each test runs in milliseconds
- **Mocked**: All dependencies must be mocked (fs, env, Date.now, process)
- **Factory-based DI**: Use dependency injection patterns (see `step_persistence.ts`, `gating_runtime.ts`)

**Coverage Thresholds (Enforced but not yet met):**
- Lines: ≥ 80% (current: ~56%)
- Branches: ≥ 75% (current: ~90% ✅)
- Statements: ≥ 80% (current: ~56%)
- Functions: ≥ 80% (current: ~75%)

> **Note**: Coverage thresholds are enforced in `vitest.unit.config.js` but are not yet fully met. The `test:unit:coverage` command will currently fail with coverage errors. This is intentional - thresholds drive incremental improvement.

**Examples:**
```typescript
// packages/cli/src/__tests__/step_persistence.test.ts
import { createStepPersistence } from "../step_persistence.ts";

describe("writeJsonAtomic", () => {
  it("should handle fsync EPERM gracefully", () => {
    const persistence = createStepPersistence({
      fs: {
        writeFileSync: vi.fn(),
        fsyncSync: () => { throw Object.assign(new Error("fsync failed"), { code: "EPERM" }); },
        // ... other mocks
      },
    });
    
    // Test deterministic behavior with mocked fs
    persistence.writeJsonAtomic("/test.json", { data: "test" });
    expect(writtenFiles.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests
**Location:**
- `tests/**/*.{test,spec}.{js,ts,tsx}`

**Characteristics:**
- **End-to-end**: Test complete workflows across module boundaries
- **Real I/O**: May use filesystem, CLI execution, and fixtures
- **Still deterministic**: Use temporary directories, no external API calls
- **Contract validation**: Verify schemas, file formats, CLI exit codes

**Coverage:**
- Coverage is collected but **not enforced** for integration tests
- Integration tests verify behavior, not code paths

**Examples:**
```typescript
// tests/agentic/cli-behavior.test.ts
describe("CLI behavior", () => {
  it("should execute planner and generate plan.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
    try {
      // Real filesystem interaction in temp directory
      execSync(`node scripts/agentic.ts planner --mode dry-run`, { cwd: tmpDir });
      const planPath = path.join(tmpDir, "runs", "run-123", "plan.json");
      expect(fs.existsSync(planPath)).toBe(true);
      const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
      expect(plan.schema_version).toBe("plan.v1");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

## File Split Rule (Milestone 2)

**When a test file MUST be split:**

A test file **must be split** into separate unit and integration files if it contains:
1. **Pure logic tests** (mocked dependencies, deterministic assertions)
2. **AND** CLI/IO/flow tests (real filesystem, process execution, multi-step workflows)

**Example - Before (single file, mixed):**
```typescript
// tests/agentic/agents.test.ts
describe("buildDecision", () => {
  it("should return halt on hard fail", () => {
    // Unit test - pure logic, mocked
  });
});

describe("runAgent CLI", () => {
  it("should execute agent and write artifacts", () => {
    // Integration test - real I/O, CLI execution
  });
});
```

**Example - After (split for Milestone 2):**
```typescript
// packages/cli/src/__tests__/agents.test.ts (UNIT)
describe("buildDecision", () => {
  it("should return halt on hard fail", () => {
    const decision = buildDecision({ strictness: "soft", gateOutcome: hardFail, ... });
    expect(decision.decision.action).toBe("halt");
  });
});

// tests/agentic/agents-cli.test.ts (INTEGRATION)
describe("runAgent CLI", () => {
  it("should execute agent and write artifacts", () => {
    const tmpDir = fs.mkdtempSync(...);
    execSync(`node scripts/agentic.ts run-agent planner`);
    expect(fs.existsSync(path.join(tmpDir, "outputs", "planner", "result.json"))).toBe(true);
  });
});
```

## Running Tests

### npm/pnpm Scripts

**All scripts use `pnpm exec vitest` internally for Windows compatibility.**

```bash
# Unit tests only (will PASS - 58 tests)
pnpm run test:unit

# Unit tests with coverage enforcement (will FAIL on coverage thresholds)
pnpm run test:unit:coverage

# Integration tests only (will PASS - 74 tests)
pnpm run test:integration

# All tests (unit + integration) (will PASS - 132 tests)
pnpm run test:all
pnpm run test  # alias for test:all

# Coverage (same as test:unit:coverage - thresholds enforced)
pnpm run test:coverage

# Watch mode (all tests)
pnpm run test:watch
```

**Current Test Status:**
- ✅ All 58 unit tests pass
- ✅ All 74 integration tests pass  
- ✅ All 132 total tests pass
- ⚠️ Unit coverage thresholds not yet met (lines 56%, need 80%)

### Make Targets

```bash
# Unit tests only
make test-unit

# Unit tests with enforced coverage (80/75/80/80)
make test-unit-coverage

# Integration tests only
make test-integration

# All tests (unit + integration)
make test

# Coverage (unit tests only, alias)
make test-coverage
```

## CI/CD Integration

**Recommended pipeline (when coverage thresholds are met):**
```yaml
test:
  stage: test
  script:
    - pnpm run typecheck         # Type safety
    - pnpm run test:unit:coverage # Unit tests with enforced thresholds
    - pnpm run test:integration  # Integration tests (must pass)
```

**Current interim pipeline (while coverage is being improved):**
```yaml
test:
  stage: test
  script:
    - pnpm run typecheck         # Type safety
    - pnpm run test:unit         # Unit tests (must pass, no coverage gating yet)
    - pnpm run test:integration  # Integration tests (must pass)
```

**Coverage enforcement:**
- Only **unit test coverage** will be gating in CI (once thresholds are met)
- Integration tests **must pass** but don't contribute to coverage metrics
- Use `pnpm` commands, not `npm`, to respect packageManager field

## Configuration Files

- **vitest.unit.config.js** - Unit tests configuration with coverage thresholds
- **vitest.integration.config.js** - Integration tests configuration (no coverage gating)
- **vitest.config.js** - All tests configuration (legacy/compatibility)

## Best Practices

### Unit Tests
1. **Always mock external dependencies**: fs, network, Date.now, process.env
2. **Use factory-based DI**: Pass dependencies as parameters (see `createStepPersistence`)
3. **Test one thing**: Each test should verify a single behavior
4. **Descriptive names**: Test names should read like specifications

### Integration Tests
5. **Use temp directories**: `fs.mkdtempSync` + cleanup in `finally`
6. **Test contracts**: Verify schemas, exit codes, file formats
7. **No external APIs**: Use fixtures and local state only
8. **Clean up**: Always remove temp files/directories

### Common Pitfalls
- ❌ Don't use `fs.readFileSync` in unit tests without mocking
- ❌ Don't call real executables in unit tests
- ❌ Don't use `new Date()` or `Date.now()` without mocking
- ✅ Do use `vi.spyOn(process, 'cwd')` to control paths
- ✅ Do use `vi.useFakeTimers()` for time-dependent tests
- ✅ Do verify cleanup in integration tests

## Migration Timeline

- **Milestone 1** (Current): Separate configs and commands, no file moves
- **Milestone 2** (Future): Split mixed test files into unit/integration
- **Milestone 3** (Future): Introduce stress tests for performance benchmarks

## Questions?

See existing tests for patterns:
- **Unit**: `packages/cli/src/__tests__/step_persistence.test.ts`
- **Integration**: `tests/agentic/cli-behavior.test.ts`

For DI patterns, refer to:
- `packages/cli/src/step_persistence.ts` (factory pattern)
- `packages/cli/src/gating_runtime.ts` (dependency injection)
