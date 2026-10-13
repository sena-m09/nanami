import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { markDirectoryTrusted } from "./trust.ts";

function writeClaudeJson(content: unknown): string {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "nanami-trust-")), ".claude.json");
  writeFileSync(file, JSON.stringify(content), { mode: 0o600 });
  return file;
}

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

test("作業ディレクトリが信頼済みになり、ログイン情報や他のディレクトリの記録はそのまま残る", async () => {
  const file = writeClaudeJson({
    oauthAccount: { emailAddress: "someone@example.com" },
    projects: {
      "/work/other": { hasTrustDialogAccepted: true, allowedTools: ["Bash"] },
      "/work/run-1": { hasTrustDialogAccepted: false, lastCost: 0.5 },
    },
  });

  await markDirectoryTrusted(file, "/work/run-1");

  assert.deepEqual(read(file), {
    oauthAccount: { emailAddress: "someone@example.com" },
    projects: {
      "/work/other": { hasTrustDialogAccepted: true, allowedTools: ["Bash"] },
      "/work/run-1": { hasTrustDialogAccepted: true, lastCost: 0.5 },
    },
  });
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test("まだ一度も起動していない設定ディレクトリには、何も作らない", async () => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "nanami-trust-")), ".claude.json");

  await markDirectoryTrusted(file, "/work/run-1");

  assert.throws(() => statSync(file));
});
