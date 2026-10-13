import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { COMMON_HOOKS_SETTINGS } from "../runner/paths.ts";

const runDir = process.argv[2];
if (!runDir) {
  console.error("使い方: node hooks/check-run.ts <runs/ の下のディレクトリ>");
  process.exit(1);
}

let ok = true;
const fail = (message: string) => {
  ok = false;
  console.log(`NG: ${message}`);
};

const hookedEvents = Object.keys(JSON.parse(readFileSync(COMMON_HOOKS_SETTINGS, "utf8")).hooks);

const eventsFile = path.join(runDir, "events.jsonl");
const events = existsSync(eventsFile)
  ? readFileSync(eventsFile, "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>)
  : [];

const counts = new Map<string, number>();
for (const event of events) {
  const name = String(event.hook_event_name);
  counts.set(name, (counts.get(name) ?? 0) + 1);
}
console.log("記録されたイベント:");
for (const name of hookedEvents) console.log(`  ${name}: ${counts.get(name) ?? 0}`);
const missing = hookedEvents.filter((name) => !counts.has(name));
if (missing.length > 0) fail(`記録されていないイベントがあります: ${missing.join(", ")}`);

const errorsFile = path.join(runDir, "logger-errors.log");
if (existsSync(errorsFile)) fail(`logger-errors.log があります。中身を確かめてください: ${errorsFile}`);

const expandHome = (p: string) => p.replace(/^~(?=\/)/, os.homedir());
const internalAgentTranscripts = new Set(
  events
    .filter((event) => event.hook_event_name === "SubagentStop" && !event.agent_type)
    .map((event) => expandHome(String(event.agent_transcript_path))),
);
const transcripts = new Set(
  events
    .flatMap((event) => [event.transcript_path, event.agent_transcript_path])
    .filter((p) => typeof p === "string")
    .map((p) => expandHome(p as string)),
);
for (const transcript of transcripts) {
  if (!existsSync(transcript)) {
    if (internalAgentTranscripts.has(transcript)) {
      console.log(`transcript なし（種類が空のサブエージェントで、ファイルは作られません）: ${transcript}`);
    } else {
      fail(`transcript が見つかりません: ${transcript}`);
    }
    continue;
  }
  const lines = readFileSync(transcript, "utf8").split("\n").filter((line) => line !== "");
  const leaks: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.includes("received_at")) leaks.push(index + 1);
    let record: Record<string, any>;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const attachment = record.attachment;
    if (typeof attachment?.type === "string" && attachment.type.startsWith("hook_")) {
      if (attachment.type !== "hook_success" || attachment.content || attachment.stdout || attachment.stderr) leaks.push(index + 1);
    }
    if (record.subtype === "stop_hook_summary") {
      if (record.hookErrors?.length || record.hookAdditionalContext?.length) leaks.push(index + 1);
    }
  }
  console.log(`transcript: ${transcript}（${lines.length} 行）`);
  if (leaks.length > 0) fail(`hook の出力かエラーが残っている行があります（${[...new Set(leaks)].join(", ")} 行目）`);
}

console.log(ok ? "OK: すべてのイベントが記録され、transcript にロガーの出力は混ざっていません" : "NG があります");
process.exitCode = ok ? 0 : 1;
