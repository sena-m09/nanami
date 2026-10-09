#!/usr/bin/env node
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../runner/config.ts";
import { launchClaude, prepareLaunch } from "../runner/launch.ts";
import { RUNS_DIR, assertConditionExists } from "../runner/paths.ts";

const USAGE = `使い方:
  nanami smoke <condition>   実験用の設定で Claude Code を空のディレクトリに起動する（例: nanami smoke c0-none）`;

async function smoke(conditionId: string | undefined): Promise<number> {
  if (!conditionId) {
    console.error(USAGE);
    return 1;
  }
  const config = await loadConfig();
  assertConditionExists(conditionId);
  const runId = `smoke-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}`;
  const runDir = path.join(RUNS_DIR, runId);
  await mkdir(runDir, { recursive: true });
  const cwd = await mkdtemp(path.join(os.tmpdir(), "nanami-smoke-"));

  const plan = await prepareLaunch({ config, conditionId, cwd, runId, runDir });
  console.log(`条件: ${conditionId}`);
  console.log(`run_id: ${runId}`);
  console.log(`作業ディレクトリ: ${cwd}`);
  console.log(`Claude Code: ${plan.bin}（${plan.claudeVersion}）`);
  return launchClaude(plan);
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "smoke":
      return smoke(args[0]);
    default:
      console.error(USAGE);
      return 1;
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
