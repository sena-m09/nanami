import { existsSync } from "node:fs";
import path from "node:path";

export const NANAMI_HOME = path.resolve(import.meta.dirname, "..");
export const CONFIG_FILE = path.join(NANAMI_HOME, "nanami.config.json");
export const CLAUDE_CONFIG_DIR = path.join(NANAMI_HOME, ".claude-config");
export const RUNS_DIR = path.join(NANAMI_HOME, "runs");

export function conditionDir(conditionId: string): string {
  return path.join(NANAMI_HOME, "conditions", conditionId);
}

export function assertConditionExists(conditionId: string): void {
  if (!existsSync(conditionDir(conditionId))) {
    throw new Error(`条件 ${conditionId} が見つかりません。conditions/ の下にあるディレクトリ名を指定してください。`);
  }
}
