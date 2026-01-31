const version = process.versions?.node || "";
const major = Number(version.split(".")[0] || "0");

const ok = major === 20 || major === 22;

if (!ok) {
  const message = [
    `Unsupported Node.js version: ${version}`,
    "",
    "This repo supports Node.js LTS only:",
    "- 20.x LTS",
    "- 22.x LTS",
    "",
    "Windows (recommended):",
    "- Install fnm or nvm-windows, then switch to Node 22 LTS (or 20 LTS)",
    "",
    "After switching:",
    "- corepack enable",
    "- pnpm install --frozen-lockfile",
  ].join("\n");
  console.error(message);
  process.exit(1);
}

