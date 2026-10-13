import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const TOOL_RESPONSE_HEAD_BYTES = 2048;

function summarizeToolResponse(response: unknown): { head: string; bytes: number } {
  const buffer = Buffer.from(JSON.stringify(response) ?? "null");
  let end = Math.min(buffer.length, TOOL_RESPONSE_HEAD_BYTES);
  if (end < buffer.length) {
    while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--;
  }
  return { head: buffer.subarray(0, end).toString("utf8"), bytes: buffer.length };
}

function logEvent(runDir: string, receivedAt: string): void {
  const input = JSON.parse(readFileSync(0, "utf8")) as Record<string, unknown>;
  const record: Record<string, unknown> = {
    received_at: receivedAt,
    run_id: process.env.NANAMI_RUN_ID ?? null,
    ...input,
  };
  if ("tool_response" in input) record.tool_response = summarizeToolResponse(input.tool_response);
  appendFileSync(path.join(runDir, "events.jsonl"), `${JSON.stringify(record)}\n`);
}

// SessionStart と UserPromptSubmit の stdout はエージェントのコンテキストに入るので、console には何も出さない
const receivedAt = new Date().toISOString();
const runDir = process.env.NANAMI_RUN_DIR;
if (runDir) {
  try {
    logEvent(runDir, receivedAt);
  } catch (error) {
    try {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      appendFileSync(path.join(runDir, "logger-errors.log"), `${receivedAt} ${detail}\n`);
    } catch {}
  }
}
process.exitCode = 0;
