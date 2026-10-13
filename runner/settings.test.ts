import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { ancestorInstructionExcludes, mergeSettings } from "./settings.ts";

const logger = { type: "command", command: 'node "$NANAMI_HOME/hooks/log-event.ts"' };
const common = {
  hooks: {
    PreToolUse: [{ matcher: "*", hooks: [logger] }],
    Stop: [{ hooks: [logger] }],
  },
};

describe("条件の設定と共通 hooks のマージ", () => {
  test("hooks を持たない条件では、条件の設定はそのまま残り、共通 hooks が足される", () => {
    const condition = { permissions: { allow: ["Bash(npm run *)"] } };

    assert.deepEqual(mergeSettings(condition, common), {
      permissions: { allow: ["Bash(npm run *)"] },
      hooks: common.hooks,
    });
  });

  test("条件が同じイベントに hook を持つときは、共通 hooks の後ろにつながり、条件だけのイベントも残る", () => {
    const harnessCheck = { matcher: "Edit", hooks: [{ type: "command", command: "npm run nanami:check" }] };
    const sessionStart = { hooks: [{ type: "command", command: "npm run dev" }] };
    const condition = { hooks: { PreToolUse: [harnessCheck], SessionStart: [sessionStart] } };

    assert.deepEqual(mergeSettings(condition, common).hooks, {
      PreToolUse: [{ matcher: "*", hooks: [logger] }, harnessCheck],
      Stop: [{ hooks: [logger] }],
      SessionStart: [sessionStart],
    });
  });
});

describe("上の階層の指示ファイルを読ませない指定", () => {
  const excluded = (file: string) =>
    ancestorInstructionExcludes("/home/someone/work/run-1").some((pattern) => path.matchesGlob(file, pattern));

  test("ホームなど上の階層の CLAUDE.md・AGENTS.md・.claude/ の中身は読み込まれない", () => {
    assert.ok(excluded("/home/someone/.claude/CLAUDE.md"));
    assert.ok(excluded("/home/someone/.claude/rules/tests.md"));
    assert.ok(excluded("/home/someone/work/AGENTS.md"));
    assert.ok(excluded("/CLAUDE.md"));
  });

  test("作業ディレクトリに置いた条件ごとの CLAUDE.md や rules は読み込まれる", () => {
    assert.ok(!excluded("/home/someone/work/run-1/CLAUDE.md"));
    assert.ok(!excluded("/home/someone/work/run-1/.claude/rules/harness.md"));
  });
});
