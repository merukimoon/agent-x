
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packagesDir = path.join(repoRoot, 'packages');

function getTsFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== 'coverage') {
                results = results.concat(getTsFiles(fullPath));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = getTsFiles(packagesDir);
let errors = 0;

console.log(`Checking ${files.length} files for illegal imports...`);

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if ((line.includes('from') || line.includes('import(')) && line.includes('scripts/')) {
            // Check if it's a relative import resolving to scripts
            // Simple heuristic: if it contains "scripts/" or "../scripts"
            if (line.match(/['"]\.\.\/.*scripts\//) || line.match(/['"]\.\.\/\.\.\/.*scripts\//)) {
                console.error(`❌ Illegal import in ${path.relative(repoRoot, file)}:${i + 1}`);
                console.error(`   ${line.trim()}`);
                errors++;
            }
        }
    });
});

if (errors > 0) {
    console.error(`Found ${errors} illegal imports from packages/ -> scripts/.`);
    process.exit(1);
} else {
    console.log('✅ No illegal imports found.');
}
