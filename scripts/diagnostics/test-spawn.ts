import { spawnSync } from "child_process";
import os from "os";

console.log(`Platform: ${os.platform()}`);
const res = spawnSync("pnpm", ["-v"], { encoding: "utf8" });
console.log(`Status: ${res.status}`);
if (res.error) {
    console.log(`Error: ${res.error.message}`);
}
console.log(`Stdout: ${res.stdout}`);
