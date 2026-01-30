import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function processFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");

    // Replace .ts extensions in relative imports
    // Match: from "something.ts" or from 'something.ts' where something starts with ./ or ../
    const updated = content.replace(
        /from\s+(['"])([./][^'"]*?)\.ts\1/g,
        'from $1$2$1'
    );

    if (content !== updated) {
        fs.writeFileSync(filePath, updated, "utf8");
        console.log(`Updated: ${path.relative(rootDir, filePath)}`);
        return 1;
    }
    return 0;
}

function walkDir(dir) {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
            count += walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            count += processFile(fullPath);
        }
    }

    return count;
}

const dirs = ["packages", "scripts", "tests"].map(d => path.join(rootDir, d));
let totalUpdated = 0;

for (const dir of dirs) {
    if (fs.existsSync(dir)) {
        console.log(`\nProcessing ${path.relative(rootDir, dir)}/...`);
        totalUpdated += walkDir(dir);
    }
}

console.log(`\n✅ Total files updated: ${totalUpdated}`);
