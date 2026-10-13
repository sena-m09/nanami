import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { HOOK_INPUTS } from "./fixtures.ts";

const LOGGER = path.join(import.meta.dirname, "log-event.ts");
const RUN_ID = "run-test";

function runLogger(input: string, env: { NANAMI_RUN_DIR?: string; cwd?: string } = {}) {
  const { NANAMI_RUN_DIR: _dir, NANAMI_RUN_ID: _id, ...parentEnv } = process.env;
  const result = spawnSync(process.execPath, [LOGGER], {
    input,
    encoding: "utf8",
    cwd: env.cwd,
    env: env.NANAMI_RUN_DIR ? { ...parentEnv, NANAMI_RUN_DIR: env.NANAMI_RUN_DIR, NANAMI_RUN_ID: RUN_ID } : parentEnv,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function newRunDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "nanami-log-event-"));
}

function readEvents(runDir: string): Record<string, unknown>[] {
  return readFileSync(path.join(runDir, "events.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
}

function withoutToolResponse(record: Record<string, unknown>): Record<string, unknown> {
  const { tool_response: _response, ...rest } = record;
  return rest;
}

function postToolUseWith(toolResponse: unknown): string {
  return JSON.stringify({ ...HOOK_INPUTS.PostToolUse, tool_response: toolResponse });
}

const SILENT_SUCCESS = { status: 0, stdout: "", stderr: "" };

describe("イベントの記録", () => {
  for (const [event, input] of Object.entries(HOOK_INPUTS)) {
    test(`${event} は、届いたフィールドに受信時刻と run_id を足した 1 行として記録され、stdout には何も出ない`, () => {
      const runDir = newRunDir();

      assert.deepEqual(runLogger(JSON.stringify(input), { NANAMI_RUN_DIR: runDir }), SILENT_SUCCESS);

      const [record, ...rest] = readEvents(runDir);
      assert.equal(rest.length, 0);
      assert.match(record.received_at as string, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.deepEqual(
        withoutToolResponse(record),
        withoutToolResponse({ received_at: record.received_at, run_id: RUN_ID, ...input }),
      );
      assert.equal("tool_response" in record, "tool_response" in input);
    });
  }

  test("続けて届いたイベントは、前の行を残したまま届いた順に追記される", () => {
    const runDir = newRunDir();

    runLogger(JSON.stringify(HOOK_INPUTS.PreToolUse), { NANAMI_RUN_DIR: runDir });
    runLogger(JSON.stringify(HOOK_INPUTS.PostToolUse), { NANAMI_RUN_DIR: runDir });

    assert.deepEqual(
      readEvents(runDir).map((record) => record.hook_event_name),
      ["PreToolUse", "PostToolUse"],
    );
  });
});

describe("tool_response の要約", () => {
  test("JSON にして 2048 バイトちょうどの応答は切られず、2049 バイトになると先頭 2048 バイトだけ残る", () => {
    const runDir = newRunDir();
    const fits = "a".repeat(2046);
    const overflows = "a".repeat(2047);

    runLogger(postToolUseWith(fits), { NANAMI_RUN_DIR: runDir });
    runLogger(postToolUseWith(overflows), { NANAMI_RUN_DIR: runDir });

    const [whole, cut] = readEvents(runDir).map((record) => record.tool_response);
    assert.deepEqual(whole, { head: JSON.stringify(fits), bytes: 2048 });
    assert.deepEqual(cut, { head: JSON.stringify(overflows).slice(0, 2048), bytes: 2049 });
  });

  test("先頭 2048 バイトの境目がマルチバイト文字の途中にかかるときは、その文字の手前で切る", () => {
    const runDir = newRunDir();
    const response = { stdout: `x${"あ".repeat(1000)}` };
    const text = JSON.stringify(response);
    assert.equal(Buffer.from(text)[2048] & 0xc0, 0x80, "前提: 2048 バイトの境目が「あ」の途中にかかる入力");

    runLogger(postToolUseWith(response), { NANAMI_RUN_DIR: runDir });

    const { head, bytes } = readEvents(runDir)[0].tool_response as { head: string; bytes: number };
    assert.equal(bytes, Buffer.byteLength(text));
    assert.ok(Buffer.byteLength(head) <= 2048);
    assert.ok(Buffer.byteLength(head) > 2048 - 3);
    assert.ok(text.startsWith(head));
  });
});

describe("記録しないときも何も出力せずに終わる", () => {
  test("NANAMI_RUN_DIR が無ければ、どこにもファイルを作らない", () => {
    const cwd = newRunDir();

    assert.deepEqual(runLogger(JSON.stringify(HOOK_INPUTS.SessionStart), { cwd }), SILENT_SUCCESS);

    assert.deepEqual(readdirSync(cwd), []);
  });

  test("JSON として読めない入力は logger-errors.log に残り、events.jsonl には書かない", () => {
    const runDir = newRunDir();

    assert.deepEqual(runLogger("{not json", { NANAMI_RUN_DIR: runDir }), SILENT_SUCCESS);

    assert.equal(existsSync(path.join(runDir, "events.jsonl")), false);
    assert.match(readFileSync(path.join(runDir, "logger-errors.log"), "utf8"), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \S/);
  });

  test("NANAMI_RUN_DIR のディレクトリが無く、エラーも書けないときも終了コードは 0", () => {
    const missing = path.join(newRunDir(), "missing");

    assert.deepEqual(
      runLogger(JSON.stringify(HOOK_INPUTS.SessionStart), { NANAMI_RUN_DIR: missing }),
      SILENT_SUCCESS,
    );
  });
});
