import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COMMON_HOOKS_SETTINGS, conditionDir } from "./paths.ts";

export type Settings = { hooks?: Record<string, unknown[]>; [key: string]: unknown };

export function mergeSettings(condition: Settings, common: Settings): Settings {
  const merged: Settings = { ...common, ...condition };
  if (!condition.hooks && !common.hooks) return merged;

  const events = new Set([...Object.keys(common.hooks ?? {}), ...Object.keys(condition.hooks ?? {})]);
  merged.hooks = Object.fromEntries(
    [...events].map((event) => [event, [...(common.hooks?.[event] ?? []), ...(condition.hooks?.[event] ?? [])]]),
  );
  return merged;
}

export function ancestorInstructionExcludes(projectDir: string): string[] {
  const patterns: string[] = [];
  let dir = path.dirname(path.resolve(projectDir));
  while (true) {
    for (const name of ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".claude/**"]) patterns.push(path.join(dir, name));
    const parent = path.dirname(dir);
    if (parent === dir) return patterns;
    dir = parent;
  }
}

export async function writeRunSettings(conditionId: string, projectDir: string, runDir: string): Promise<string> {
  const condition = await readSettings(path.join(conditionDir(conditionId), "settings.json"));
  const common = await readSettings(COMMON_HOOKS_SETTINGS);
  const settings = mergeSettings(condition, common);
  settings.claudeMdExcludes = [...((settings.claudeMdExcludes as string[] | undefined) ?? []), ...ancestorInstructionExcludes(projectDir)];
  const file = path.join(runDir, "settings.json");
  await mkdir(runDir, { recursive: true });
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`);
  return file;
}

async function readSettings(file: string): Promise<Settings> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Settings;
  } catch (error) {
    throw new Error(`${file} を JSON として読めません（${(error as Error).message}）。`);
  }
}
