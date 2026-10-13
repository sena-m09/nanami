const common = {
  session_id: "abc123",
  transcript_path: "/Users/someone/.claude-config/projects/-tmp-nanami/abc123.jsonl",
  cwd: "/tmp/nanami",
};

export const HOOK_INPUTS = {
  SessionStart: { ...common, hook_event_name: "SessionStart", source: "startup", model: "claude-opus-5-5" },
  UserPromptSubmit: {
    ...common,
    permission_mode: "default",
    hook_event_name: "UserPromptSubmit",
    prompt: "カードのタイトルと本文の間がデザインより広い",
  },
  PreToolUse: {
    ...common,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm test", description: "Run test suite", timeout: 120000, run_in_background: false },
    tool_use_id: "toolu_01ABC123",
  },
  PostToolUse: {
    ...common,
    permission_mode: "default",
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: "/tmp/nanami/src/Card.tsx", content: "export const Card = () => null;\n" },
    tool_response: { filePath: "/tmp/nanami/src/Card.tsx", type: "create" },
    tool_use_id: "toolu_01ABC123",
    duration_ms: 12,
  },
  Stop: {
    ...common,
    permission_mode: "default",
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "カードを実装しました。",
  },
  SubagentStop: {
    ...common,
    permission_mode: "default",
    hook_event_name: "SubagentStop",
    stop_hook_active: false,
    agent_id: "def456",
    agent_type: "Explore",
    agent_transcript_path: "/Users/someone/.claude-config/projects/-tmp-nanami/abc123/subagents/agent-def456.jsonl",
    last_assistant_message: "Card コンポーネントは src/Card.tsx にあります。",
  },
  Notification: {
    ...common,
    hook_event_name: "Notification",
    message: "Claude is waiting for your input",
    notification_type: "idle_prompt",
  },
  PreCompact: { ...common, hook_event_name: "PreCompact", trigger: "auto", custom_instructions: null },
  SessionEnd: { ...common, hook_event_name: "SessionEnd", reason: "prompt_input_exit" },
} satisfies Record<string, Record<string, unknown>>;
