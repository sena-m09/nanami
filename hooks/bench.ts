import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildEnv } from "../runner/launch.ts";
import { COMMON_HOOKS_SETTINGS } from "../runner/paths.ts";
import { HOOK_INPUTS } from "./fixtures.ts";

const RUNS = Number(process.argv[2] ?? 30);

const settings = JSON.parse(readFileSync(COMMON_HOOKS_SETTINGS, "utf8"));
const command: string = settings.hooks.PostToolUse[0].hooks[0].command;
const input = JSON.stringify(HOOK_INPUTS.PostToolUse);
const runDir = mkdtempSync(path.join(os.tmpdir(), "nanami-bench-"));
const sessionEnv = buildEnv(process.env, { runId: "bench", runDir });
const { NANAMI_RUN_DIR: _dir, NANAMI_RUN_ID: _id, ...normalEnv } = sessionEnv;

const resolved = spawnSync('command -v node && node --version && node -p "process.execPath"', {
  shell: true,
  env: sessionEnv,
  encoding: "utf8",
});
console.log(`hook のコマンド: ${command}`);
console.log(`hook のシェルで選ばれる node:\n${resolved.stdout.trim().replace(/^/gm, "  ")}`);

function measure(label: string, env: NodeJS.ProcessEnv): void {
  const durations: number[] = [];
  const problems: string[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const result = spawnSync(command, { shell: true, env, input, encoding: "utf8" });
    durations.push(performance.now() - start);
    if (result.status !== 0) problems.push(`終了コード ${result.status}`);
    if (result.stdout !== "") problems.push(`stdout: ${JSON.stringify(result.stdout)}`);
    if (result.stderr !== "") problems.push(`stderr: ${JSON.stringify(result.stderr)}`);
  }
  durations.sort((a, b) => a - b);
  const median = (durations[(RUNS - 1) >> 1] + durations[RUNS >> 1]) / 2;
  const ms = (value: number) => `${value.toFixed(1)}ms`;
  console.log(`${label}（${RUNS} 回）: 中央値 ${ms(median)}、最小 ${ms(durations[0])}、最大 ${ms(durations.at(-1)!)}`);
  console.log(problems.length === 0 ? "  stdout・stderr は毎回空、終了コードは毎回 0" : `  問題: ${[...new Set(problems)].join(" / ")}`);
}

measure("記録する（NANAMI_RUN_DIR あり、PostToolUse）", sessionEnv);
measure("記録しない（NANAMI_RUN_DIR なし）", normalEnv);
const lines = readFileSync(path.join(runDir, "events.jsonl"), "utf8").trim().split("\n").length;
console.log(`events.jsonl の行数: ${lines}（期待値 ${RUNS}）`);
