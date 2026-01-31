
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const TEST_RUN_NAME = 'golden-verification-run';
const RUNS_DIR = path.join(repoRoot, 'runs');
const TARGET_DIR = path.join(RUNS_DIR, `${new Date().getFullYear()}-${TEST_RUN_NAME}`); // Approximate, the script adds timestamp

function cleanUp() {
    console.log('Cleaning up old runs...');
    if (fs.existsSync(RUNS_DIR)) {
        const attempts = fs.readdirSync(RUNS_DIR).filter(d => d.includes(TEST_RUN_NAME));
        attempts.forEach(d => {
            fs.rmSync(path.join(RUNS_DIR, d), { recursive: true, force: true });
        });
    }
}

function runScaffold() {
    console.log('Running scaffold-run...');
    try {
        execSync(`node --import tsx scripts/scaffold-run.ts`, {
            cwd: repoRoot,
            env: { ...process.env, NAME: TEST_RUN_NAME },
            stdio: 'inherit'
        });
    } catch (e) {
        console.error('Scaffold run failed');
        process.exit(1);
    }
}

function verify() {
    console.log('Verifying output...');
    const runs = fs.readdirSync(RUNS_DIR).filter(d => d.includes(TEST_RUN_NAME));
    if (runs.length !== 1) {
        console.error(`Expected 1 run directory, found ${runs.length}: ${runs.join(', ')}`);
        process.exit(1);
    }

    const runDir = path.join(RUNS_DIR, runs[0]);
    const expectedFiles = [
        'run.json',
        'README.md',
        'inputs/request.md',
        'inputs/context.md',
        'outputs/coordinator/result.json',
        'outputs/coordinator/notes.md',
        'outputs/decision-maker/result.json',
        'outputs/ciso/result.json',
        'outputs/pr-reviewer/result.json',
        'summary/final.md',
        'artifacts/.gitkeep'
    ];

    for (const f of expectedFiles) {
        const p = path.join(runDir, f);
        if (!fs.existsSync(p)) {
            console.error(`Missing file: ${f}`);
            process.exit(1);
        }
    }

    // Check JSON validity for run.json
    try {
        const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
        if (runJson.slug !== TEST_RUN_NAME) {
            console.error(`run.json slug mismatch. Expected ${TEST_RUN_NAME}, got ${runJson.slug}`);
            process.exit(1);
        }
    } catch (e) {
        console.error('Invalid run.json');
        process.exit(1);
    }

    console.log('✅ Golden verification passed!');
}

cleanUp();
runScaffold();
verify();
cleanUp();
