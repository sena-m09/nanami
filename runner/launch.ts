import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { NanamiConfig } from "./config.ts";
import { CLAUDE_CONFIG_DIR, NANAMI_HOME, assertConditionExists, conditionDir } from "./paths.ts";

const execFileAsync = promisify(execFile);

// 残すと入れ子のセッション扱いになったり、ANTHROPIC_API_KEY が .claude-config のログインより優先されたりする
const INHERITED_ENV_TO_DROP = /^(CLAUDE|ANTHROPIC_)/;

export type LaunchOptions = {
  config: NanamiConfig;
  conditionId: string;
  cwd: string;
  runId: string;
  runDir: string;
};

export function buildEnv(
  parentEnv: NodeJS.ProcessEnv,
  { runId, runDir }: Pick<LaunchOptions, "runId" | "runDir">,
): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    Object.entries(parentEnv).filter(([key]) => !INHERITED_ENV_TO_DROP.test(key)),
  );
  return {
    ...inherited,
    CLAUDE_CONFIG_DIR,
    DISABLE_AUTOUPDATER: "1",
    ENABLE_CLAUDEAI_MCP_SERVERS: "false",
    NANAMI_HOME,
    NANAMI_RUN_ID: runId,
    NANAMI_RUN_DIR: runDir,
  };
}

export function buildArgs(config: NanamiConfig, conditionId: string): string[] {
  const args = ["--model", config.model, "--effort", config.effort, "--strict-mcp-config"];
  const mcpConfig = path.join(conditionDir(conditionId), ".mcp.json");
  if (existsSync(mcpConfig)) args.push("--mcp-config", mcpConfig);
  return args;
}

export type LaunchPlan = {
  bin: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  claudeVersion: string;
};

export async function readClaudeVersion(bin: string, env: NodeJS.ProcessEnv): Promise<string> {
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { env });
    return stdout.trim().split(" ")[0];
  } catch (error) {
    throw new Error(
      `${bin} --version を実行できませんでした（${(error as Error).message}）。` +
        "PATH に claude があるか、nanami.config.json の claudeCode.bin のパスが正しいかを確かめてください。",
    );
  }
}

export async function prepareLaunch(options: LaunchOptions): Promise<LaunchPlan> {
  const { config, conditionId, cwd } = options;
  assertConditionExists(conditionId);

  const bin = config.claudeCode.bin ?? "claude";
  const env = buildEnv(process.env, options);
  const claudeVersion = await readClaudeVersion(bin, env);
  if (claudeVersion !== config.claudeCode.version) {
    console.warn(
      `警告: Claude Code の version が nanami.config.json と違います（設定: ${config.claudeCode.version}、実際: ${claudeVersion}）。このまま起動します。`,
    );
  }
  return { bin, args: buildArgs(config, conditionId), env, cwd, claudeVersion };
}

export async function launchClaude({ bin, args, env, cwd }: LaunchPlan): Promise<number> {
  const child = spawn(bin, args, { cwd, env, stdio: "inherit" });
  // Ctrl-C は Claude Code の入力操作なので、親の node が先に死んで端末を壊さないよう握りつぶす
  const ignoreSigint = () => {};
  process.on("SIGINT", ignoreSigint);
  try {
    return await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    process.off("SIGINT", ignoreSigint);
  }
}
