import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const engine = "C:/Users/Administrator/.agents/skills/media-use/audio/scripts/audio.mjs";
const args = process.argv.slice(2);

if (!args.includes("--provider")) args.push("--provider", "kokoro");
if (!args.includes("--voice")) args.push("--voice", "zf_xiaobei");
if (!args.includes("--lang")) args.push("--lang", "zh");
if (!args.includes("--no-bgm")) args.push("--no-bgm");

const offlineConfig = join(dirname(fileURLToPath(import.meta.url)), "offline-heygen");
const result = spawnSync(process.execPath, [engine, ...args], {
  stdio: "inherit",
  env: { ...process.env, HEYGEN_CONFIG_DIR: offlineConfig },
});

process.exit(result.status ?? 1);
