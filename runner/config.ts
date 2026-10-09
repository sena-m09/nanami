import { readFile } from "node:fs/promises";
import { CONFIG_FILE } from "./paths.ts";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
};

export type NanamiConfig = {
  claudeCode: { version: string; bin?: string };
  model: string;
  effort: Effort;
  limits: { elapsedMinutes: number; extraPrompts: number };
  sandbox: { path: string; baseCommit: string };
  pricing: { asOf: string; models: Record<string, ModelPricing> };
};

export class ConfigError extends Error {
  constructor(file: string, problems: string[]) {
    super(`${file} に問題があります:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

export async function loadConfig(file: string = CONFIG_FILE): Promise<NanamiConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new ConfigError(file, [`JSON として読めません（${(error as Error).message}）`]);
  }
  const problems = validateConfig(raw);
  if (problems.length > 0) throw new ConfigError(file, problems);
  return raw as NanamiConfig;
}

export function validateConfig(raw: unknown): string[] {
  const problems: string[] = [];
  const at = (key: string): unknown => get(raw, key);

  const expectString = (key: string) => {
    if (typeof at(key) !== "string") problems.push(`${key} は文字列で書いてください`);
  };
  const expectNonEmpty = (key: string) => {
    const value = at(key);
    if (typeof value !== "string" || value === "") problems.push(`${key} を空でない文字列で書いてください`);
  };
  const expectPositiveInt = (key: string) => {
    const value = at(key);
    if (!Number.isInteger(value) || (value as number) <= 0) problems.push(`${key} は 1 以上の整数で書いてください`);
  };

  if (!isObject(raw)) return ["設定全体をオブジェクトで書いてください"];

  expectNonEmpty("claudeCode.version");
  if (at("claudeCode.bin") !== undefined) expectNonEmpty("claudeCode.bin");
  expectNonEmpty("model");
  if (!EFFORTS.includes(at("effort") as Effort)) {
    problems.push(`effort は ${EFFORTS.join(" / ")} のどれかにしてください`);
  }
  expectPositiveInt("limits.elapsedMinutes");
  expectPositiveInt("limits.extraPrompts");
  expectString("sandbox.path");
  expectString("sandbox.baseCommit");
  expectString("pricing.asOf");

  const models = at("pricing.models");
  if (!isObject(models)) {
    problems.push("pricing.models はモデル ID をキーにしたオブジェクトで書いてください");
  } else {
    for (const [model, pricing] of Object.entries(models)) {
      for (const field of ["inputPerMTok", "outputPerMTok", "cacheWritePerMTok", "cacheReadPerMTok"]) {
        const value = get(pricing, field);
        if (typeof value !== "number" || value < 0) {
          problems.push(`pricing.models["${model}"].${field} は 0 以上の数値で書いてください`);
        }
      }
    }
  }

  return problems;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function get(value: unknown, dottedKey: string): unknown {
  let current = value;
  for (const key of dottedKey.split(".")) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}
