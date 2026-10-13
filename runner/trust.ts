import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function markDirectoryTrusted(claudeJsonFile: string, dir: string): Promise<void> {
  if (!existsSync(claudeJsonFile)) return;
  const config = JSON.parse(await readFile(claudeJsonFile, "utf8"));
  const projects = config.projects ?? {};
  if (projects[dir]?.hasTrustDialogAccepted === true) return;

  config.projects = { ...projects, [dir]: { ...projects[dir], hasTrustDialogAccepted: true } };
  const temp = path.join(path.dirname(claudeJsonFile), `.claude.json.nanami-${process.pid}`);
  await writeFile(temp, JSON.stringify(config, null, 2), { mode: 0o600 });
  await rename(temp, claudeJsonFile);
}
