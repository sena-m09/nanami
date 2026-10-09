# nanami

プレゼンテーショナルコンポーネントを AI に実装させるとき、Playwright のハーネスとデザイントークンがどれだけ効くかを測るための基盤です。設計と実験の手順は [docs/nanami-design.md](docs/nanami-design.md) にあります。

## 準備

Node.js 24 以上が必要です。TypeScript のファイルは Node がそのまま実行するので、ビルドはありません。

```sh
npm ci
```

Claude Code は、普段使っている `claude`（PATH 上にあるもの）をそのまま使います。シェルを通さずに起動するので、`claude` をシェル関数やエイリアスで包んでいても、その中身は使われません。別の場所にある claude を使いたいときは、`nanami.config.json` の `claudeCode.bin` に絶対パスを書いてください。

## 実験用の Claude Code を起動する

```sh
node bin/nanami.ts smoke <condition>
```

`<condition>` には `conditions/` の下のディレクトリ名（`c0-none`・`c1-pw`・`c2-tokens-pw`）を指定します。中身が空の一時ディレクトリを作り、そこで Claude Code を起動します。起動時には次の設定が入ります。

- 設定ディレクトリを `.claude-config/` に切り替える（`CLAUDE_CONFIG_DIR`）。普段の `~/.claude` にある CLAUDE.md・skills・プラグイン・hooks は読み込まれません
- 自動更新を止める（`DISABLE_AUTOUPDATER=1`）
- claude.ai アカウントのコネクタを読み込まない（`ENABLE_CLAUDEAI_MCP_SERVERS=false`）
- MCP は `--strict-mcp-config` で、渡したものだけに絞る。`conditions/<condition>/.mcp.json` があるときだけ `--mcp-config` で渡す
- モデルと effort は `nanami.config.json` の値を `--model`・`--effort` で渡す
- `NANAMI_HOME`・`NANAMI_RUN_ID`・`NANAMI_RUN_DIR` を渡す。smoke の run_id は `smoke-<日時>` で、`runs/` の下に空のディレクトリができます
- 親のシェルから受け継いだ `CLAUDE` で始まる環境変数と `ANTHROPIC_` で始まる環境変数を外す

起動する前に `claude --version` を読み、`nanami.config.json` の `claudeCode.version` と違えば警告を出します。起動はそのまま続きます。

## 初回だけ：実験用の設定でログインする

`.claude-config/` は普段の設定と別なので、最初の起動でログインし直す必要があります。

1. `node bin/nanami.ts smoke c0-none` を実行します。
2. テーマの選択とログインの案内が出るので、普段と同じアカウントでログインします。
3. `/exit` で終了します。
4. 別のターミナルで普段の `claude` を起動し、ログインし直しを求められないことを確かめます。求められた場合は、実験用のログインが普段のログインを上書きしています。

## 隔離できているか確かめる

普段の設定に入っている skills・MCP・agent が、実験用の Claude Code から見えないことを確かめる手順です。

1. `node bin/nanami.ts smoke c0-none` を実行します。表示された作業ディレクトリが、`/var/folders/` の下の一時ディレクトリになっていることを確かめます。
2. フォルダを信頼するか聞かれたら、信頼すると答えます。
3. `/status` を開き、モデルが `nanami.config.json` の `model` と同じことを確かめます。
4. `/mcp` を開き、MCP サーバーが 1 つも無いことを確かめます。「claude.ai Slack」「claude.ai Google Drive」のように `claude.ai` で始まるものが出ていないかも見ます。
5. `/context` を開き、Memory files に CLAUDE.md が無いこと、MCP tools が 0 件であることを確かめます。
6. 「使える skills と MCP を全部挙げて」と聞きます。
7. 3〜6 で出てきた skill・agent・MCP を、下の「出どころで判定する」に沿って 1 つずつ分けます。
8. `c1-pw` でも 1〜7 を繰り返します。`conditions/c1-pw/.mcp.json` はまだ空なので、MCP は 0 件のままになるはずです。

### 出どころで判定する

名前の一覧と見比べるのではなく、普段の設定の中にあるかどうかで判定します。次のどれかに当てはまるものが出ていたら、普段の設定が漏れています。

- skill の名前が `~/.claude/skills/` の下のディレクトリ名と同じ
- agent の名前が `~/.claude/agents/` の下のファイル名と同じ
- `figma:code-connect` のように「プラグイン名:」で始まる skill で、そのプラグインが `~/.claude/settings.json` の `enabledPlugins` に入っている
- MCP サーバーの名前が `plugin:` で始まる（プラグインが持ち込んだ MCP）
- `/context` の Memory files に CLAUDE.md や AGENTS.md が出ている

`claude.ai` で始まる MCP サーバー（ツール名なら `mcp__claude_ai_` で始まるもの）が出ていた場合も、普段の設定が漏れています。こちらは `~/.claude` ではなく claude.ai アカウントから来ています。

どれにも当てはまらないものは、Claude Code に最初から入っているものか、アカウントから届くものです。漏れには数えず、名前を控えておいてください。`anthropic-skills:docs` のように `anthropic-skills:` で始まる skill は、`enabledPlugins` に無くてもアカウント側から届くことがあります。出ていたら、受け入れるかどうかを決めるために記録してください。

参考までに、2.1.287 でログインせずに起動したときは、次のものが最初から入っていました。version が変わると増減します。

- skill：deep-research、design、design-sync、dataviz、update-config、verify、debug、code-review、simplify、batch、fewer-permission-prompts、doctor、loop、claude-api、workflow-authoring、run、run-skill-generator、plugin-authoring
- agent：claude、Explore、general-purpose、Plan、statusline-setup

## 漏れていたときに見るところ

- **claude.ai のコネクタが出る**：`ENABLE_CLAUDEAI_MCP_SERVERS=false` が効いていません。受け入れるか、別のアカウントでログインするかを決めてください。
- **管理者向けの設定がある**：`/Library/Application Support/ClaudeCode/` に `managed-settings.json` や `managed-mcp.json` があると、設定ディレクトリを変えても読み込まれます。
- **作業ディレクトリの親に CLAUDE.md がある**：Claude Code は作業ディレクトリから親へさかのぼって CLAUDE.md を読みます。smoke は一時ディレクトリで動くので当たりませんが、実験で worktree を置く場所を決めるときは、親に `CLAUDE.md` や `.claude/` が無い場所を選んでください。たとえば `~/works/.claude/` があるので、`~/works` の下は避けたほうが安全です。

## Claude Code の version について

実験用のセッションには `DISABLE_AUTOUPDATER=1` を渡すので、セッションの途中で version が変わることはありません。ただ、普段の `claude` は自動更新されるので、ランとランの間に version が変わることがあります。

実験期間中は、普段の `claude` の自動更新も止めておくと version がそろいます。シェルの環境変数か `~/.claude/settings.json` の `env` に `DISABLE_AUTOUPDATER=1` を入れると止まります。

`claudeCode.version` には、実験でそろえたい version を書いておきます。実際に使った version は起動時に表示されます。
