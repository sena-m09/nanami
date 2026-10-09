# プレゼンテーショナルコンポーネント実装ハーネス 効果測定基盤 セットアップガイド

Oct 9, 2026 · @Sena Murakami

## 目的と決定事項

プレゼンテーショナルコンポーネントを AI にピクセルパーフェクトで実装させるとき、Playwright ハーネスとデザイントークンがどれだけ効くかを、3条件の比較で計測する。将来の「非エンジニアでもフロントエンド実装ができる」体制づくりの、一番手前の検証にあたる。

| 条件 ID | 内容 |
| --- | --- |
| c0-none | ハーネスなし |
| c1-pw | Playwright フィードバックループのハーネスあり |
| c2-tokens-pw | デザイントークン＋Playwright ハーネスあり |

| 指標 | 定義 | データ源 |
| --- | --- | --- |
| エージェント稼働時間（主軸） | 各プロンプト送信から次の Stop までの区間の合計 | hooks |
| 総経過時間・人間待ち時間 | 参考値。総経過時間 − 稼働時間 ＝ 人間待ち | hooks |
| 指示回数 | 初回プロンプトを除く追加指示の件数、種別ラベルごとの内訳 | hooks＋事後ラベル |
| トークン | input / output / cache_creation / cache_read を分けて集計。サブエージェント分も含む | transcript |
| 再現精度 | 独立評価器による差分率・SSIM（held-out 含む）、トークン準拠率 | 評価器 |
| ツール使用タイミング | 分類済みツール呼び出しの時刻とフェーズ | hooks＋transcript |
| 成功率 | success / timeout / gave_up の割合 | runner |

決定事項：

- 実施者は Sena 1名。Sena がブラウザで目視確認し、OK と判断した時点を完了とする（完了時刻＝OK 直前の最後の Stop）
- 打ち切りは「総経過時間 60 分」または「追加指示 10 回でも OK にならない」。該当したランは timeout として記録し、精度評価はその時点のコードで行う
- 時間の比較はエージェント稼働時間を主軸にする
- 1ラン＝1セッション。実装は1セッション内で終え、そのセッションログを計測に使う
- エージェントは Claude Code。バージョンとモデルは実験期間中は固定する

## 実験プロトコル

条件の差は CLAUDE.md・skills・ツール設定にだけ置き、初回プロンプトと介入の仕方は全条件で同一にする。実施者がエンジニアなので、「非エンジニアなら言えること」を介入ルールで縛るのがこの実験の要。

### 1ランの流れ

1. `nanami start` で run_id を発行し、worktree 作成と条件ファイルの配置を行う
2. runner が環境変数付きで Claude Code を起動する
3. `tasks/<task>/prompt.md` の固定文をそのまま初回プロンプトとして貼る
4. エージェントが完了を報告したら、Sena がブラウザで目視確認する
5. NG なら介入ルールに従って追加指示。OK ならセッションを終了する
6. `nanami finish` で outcome を入力。runner が transcript と差分を保存し、評価器を実行する
7. 後でまとめて `nanami label` で追加指示に種別ラベルを付ける

### 介入ルール

基準は「デザイナーが Figma を見ながら言えること」。Figma 上の値（16px など）は言ってよいが、CSS プロパティ名・コード・ツール名は出さない。ハーネスをいつ使うか自体が測定対象なので、「Playwright を回して」のようなツール使用の指示はしない。

| ラベル | 内容 | 例 | 扱い |
| --- | --- | --- | --- |
| visual | 見た目のズレを、場所・状態・どう違うかで伝える | 「SP 幅で、カードのタイトルと本文の間がデザインより広い」 | 可 |
| reference | 正解画像やスクショの該当箇所を示す | 「この画像の右上のアイコンの位置を見て」 | 可 |
| nudge | 続行・再確認を促す | 「もう一度デザインと見比べて」 | 可 |
| spec | お題に書いておくべき仕様の補足 | 「ホバー時は背景が薄くなる」 | 可。ただし発生したら次のラン前にお題を直す |
| technical | コード・ CSS・ツールの具体的な指示 | 「gap を 16px にして」「Playwright を実行して」 | 原則禁止。やむを得ず使ったら必ずこのラベル |
| env | エラー解消など、実験環境側の対応 | 「サーバーを再起動したので続けて」 | 可。多発したら環境を直す |

運用上の約束：

- 1回の指示に伝えるズレは最大 3 点。目についた順ではなく、大きいズレから伝える
- ラベルはプロンプトに書かず、事後に付ける（タグがエージェントのコンテキストに入るのを避けるため）。1指示に複数種別が混じったら、最も技術寄りのラベルを付ける
- 権限確認のダイアログは指示に数えない。ただし発生しないように許可設定を揃える（環境の節を参照）

### お題と反復

- お題は難易度の違う 3 つ：S（ボタン。状態が多い）、M（カード）、L（複数ブロックを含むレイアウト）
- まず 3 お題 × 3 条件 × 3 回 ＝ 27 ラン。ばらつきが大きければ 5 回まで増やす
- 実行順は `nanami plan` がシャッフルして `schedule.csv` に出す。同じお題が連続しないようにして、実施者の学習効果を分散させる
- 実装先（ファイルパスや Story 名）はお題の仕様に書き、全条件で同じ場所に描画されるようにする。評価器はその URL を撮影する

## 環境の固定と隔離

普段使っているグローバル設定（dotfiles 管理の CLAUDE.md・skills・MCP）が全条件に漏れるのが最大の汚染源なので、実験専用の設定ディレクトリで動かす。

| 項目 | 方針 |
| --- | --- |
| 設定ディレクトリ | `CLAUDE_CONFIG_DIR=<nanami>/.claude-config` で起動。初回に一度だけログイン。transcript もこの配下にたまる |
| Claude Code バージョン | 利用者が普段使っている PATH 上の `claude`（`nanami.config.json` の `claudeCode.bin` で差し替え可）を、シェルを通さずに起動する。実験用セッションには `DISABLE_AUTOUPDATER=1` を渡す。起動前に `claude --version` を読み、`claudeCode.version` と違えば警告して起動は続け、実際の version を meta に記録。実験期間中は普段の claude の自動更新も止めて version をそろえる |
| モデル | `--model` と `--effort` で明示し、meta に記録 |
| 対象アプリ | 別リポジトリ（sandbox）の固定コミットから、ランごとに `git worktree` を切る |
| 条件ファイル | `conditions/<id>/` の CLAUDE.md・skills・ハーネス・トークンを worktree にコピー。`.mcp.json` はコピーせず起動引数で渡す。c0 にはハーネス関連を一切置かない |
| 計測用 hooks | 全条件共通で `.claude/settings.json` に入れる。条件側の設定とマージする |
| 権限 | 許可ルールを全条件で同一にし、実装中に権限ダイアログが出ないようにする。出るとその待ち時間が稼働時間に混ざる |
| MCP | 起動時に常に `--strict-mcp-config` を付け、c1・c2 だけ `conditions/<id>/.mcp.json` を `--mcp-config` で渡す。worktree には `.mcp.json` を置かないので、承認ダイアログが出ず、エージェントからも見えない。claude.ai アカウントのコネクタは `ENABLE_CLAUDEAI_MCP_SERVERS=false` で切る |
| run の紐付け | runner が `NANAMI_RUN_ID` と `NANAMI_RUN_DIR` を環境変数で渡す。worktree 内には計測用ファイルを置かない（エージェントが読めてしまうため） |
| 開発サーバー | ポートとフォントを固定。ランごとに立ち上げ直す |

隔離できているかは、スモークランでエージェントに「使える skills と MCP を全部挙げて」と聞き、条件外のものが出ないことで確認する。

## リポジトリ構成とデータスキーマ

計測基盤は `nanami` として対象アプリと別リポジトリにし、収集は JSONL、集計は DuckDB に分ける。JSONL を生のまま残すので、指標を後から足しても過去のランを再集計できる。

データの流れ（元ドキュメントの図をテキストに起こしたもの）：

```text
書き出し元                         生データ                      集計
hooks/log-event.ts   ──┐
runner (start/finish/label) ─┤
ハーネスのログ出力     ──┼──▶  runs/<run_id>/*  ──▶  analysis/ingest.ts ──▶ nanami.duckdb ──▶ report/build.ts ──▶ dist/
独立評価器 (eval/)     ──┘
```

左の 4 つが書き出し元、中央の runs/ が生データ、右が集計。runs/ を正とし、DuckDB とレポートは何度でも作り直せる。

```text
nanami/
  nanami.config.json        # Claude Code 版・モデル・effort・打ち切り上限・sandbox のパスと基準コミット・単価
  conditions/
    c0-none/               # CLAUDE.md, settings.json, classify.json
    c1-pw/                 # ＋ skills/, harness/, .mcp.json（.mcp.json は --mcp-config で渡す）
    c2-tokens-pw/          # ＋ tokens/
  tasks/
    s-button/              # prompt.md, spec.md, reference/*.png, eval.json
    m-card/
    l-layout/
  hooks/log-event.ts       # 全条件共通のイベントロガー（stdout に何も出さない）
  bin/nanami.ts            # CLI の入口
  runner/                  # nanami plan / start / finish / label
  eval/                    # Dockerfile, evaluate.ts
  analysis/                # ingest.ts, views.sql
  report/                  # build.ts → dist/
  runs/<run_id>/
    meta.json              # 条件・お題・回数・版・モデル・outcome
    events.jsonl           # hooks の生イベント
    transcript/            # セッションとサブエージェントの JSONL のコピー
    harness.jsonl          # ハーネス自身の実行ログ（c1・c2 のみ）
    final.patch            # 基準コミットからの差分
    eval/                  # スクショ・差分ヒートマップ・scores.json
    labels.json            # 追加指示の種別ラベル
  nanami.duckdb
  schedule.csv
```

```sql
CREATE TABLE runs (
  run_id TEXT PRIMARY KEY, condition TEXT, task TEXT, rep INT,
  model TEXT, cc_version TEXT, outcome TEXT,  -- success | timeout | gave_up
  started_at TIMESTAMP, ended_at TIMESTAMP
);
CREATE TABLE events (
  run_id TEXT, ts TIMESTAMP, kind TEXT,      -- user_prompt | pre_tool | post_tool | stop | subagent_stop | notification | pre_compact | session_start | session_end
  tool TEXT, category TEXT, phase TEXT,      -- category は classify.json で付与
  round INT,                                 -- その時点までの追加指示の回数
  detail JSON
);
CREATE TABLE llm_calls (
  run_id TEXT, ts TIMESTAMP, message_id TEXT, model TEXT, is_sidechain BOOLEAN,
  input_tokens INT, output_tokens INT, cache_creation_tokens INT, cache_read_tokens INT
);
CREATE TABLE prompts (
  run_id TEXT, ts TIMESTAMP, seq INT, text TEXT, label TEXT  -- seq 0 は初回プロンプト
);
CREATE TABLE harness_runs (
  run_id TEXT, ts TIMESTAMP, viewport TEXT, state TEXT, diff_ratio DOUBLE, passed BOOLEAN
);
CREATE TABLE evals (
  run_id TEXT, viewport TEXT, state TEXT, held_out BOOLEAN,
  diff_ratio DOUBLE, ssim DOUBLE, size_delta_px INT, token_adherence DOUBLE
);
```

## データ収集

時刻と順序は hooks、トークンは transcript、収束の様子はハーネス自身のログから取る。どれもエージェントのコンテキストには何も足さない。

### hooks ロガー

全条件の `.claude/settings.json` に同じ hooks を入れる。`UserPromptSubmit` と `SessionStart` は stdout がコンテキストに注入されるので、ロガーはファイルに追記するだけで stdout には何も書かず、常に exit 0 で終わる。

```json
{
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "PreToolUse":       [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "PostToolUse":      [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "Notification":     [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "PreCompact":       [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "node \"$NANAMI_HOME/hooks/log-event.ts\"" }] }]
  }
}
```

`log-event.ts` の要件：

- stdin の JSON（session_id、transcript_path、hook_event_name、tool_name、tool_input、prompt など）に、受信時刻と `NANAMI_RUN_ID` を足して `$NANAMI_RUN_DIR/events.jsonl` に 1 行追記する
- `tool_response` は大きいので先頭 2KB とバイト数だけ残す
- 環境変数が無いとき（普段の利用）は何もせず終了する。例外は握りつぶして `$NANAMI_RUN_DIR/logger-errors.log` に書く
- イベントごとに数十 ms かかるが、全条件に等しく乗るので許容する

### transcript

`nanami finish` が、hooks に残った `transcript_path` の JSONL と、同じセッションのサブエージェントの JSONL（版によっては別ファイル）を `runs/<run_id>/transcript/` にコピーする。集計時の注意：

- assistant 応答は content block ごとに複数行へ分かれ、同じ usage が重複して現れることがある。`message.id` で重複を除く
- `isSidechain` で本体とサブエージェントを区別して保持する
- 形式は公式に安定した仕様ではない。未知のフィールドは無視し、読めなかった行数を ingest の終わりに表示する
- 検算はセッション終了時の `/cost` の表示（または OpenTelemetry のメトリクス）と突き合わせる

### ハーネス自身のログ

Playwright ハーネスに、`NANAMI_RUN_DIR` があるときだけ `harness.jsonl` へ `{ts, viewport, state, diff_ratio, passed}` を追記する処理を入れる。エージェントが見る出力は変えない。これが「差分が反復ごとにどう収束したか」の元データになる。

### ツール分類

`conditions/<id>/classify.json` のルールを上から順に評価し、最初に当たった category を付ける。

```json
{
  "rules": [
    { "category": "harness", "tool": "Bash", "inputMatch": "playwright|nanami:compare" },
    { "category": "harness", "toolPrefix": "mcp__playwright__" },
    { "category": "tokens",  "tool": ["Read", "Grep", "Glob"], "inputMatch": "tokens/|--ds-" },
    { "category": "reference_image", "tool": "Read", "inputMatch": "reference/.*\\.png$" },
    { "category": "skill",   "tool": "Skill" },
    { "category": "edit",    "tool": ["Edit", "Write", "MultiEdit"] },
    { "category": "explore", "tool": ["Read", "Grep", "Glob", "LS"] },
    { "category": "run",     "tool": "Bash" }
  ],
  "default": "other"
}
```

phase は「最初の edit より前＝explore」「初回プロンプトのターン内＝initial」「追加指示後＝fix」とし、round（何回目の修正ラウンドか）も合わせて持つ。

## 独立評価器

再現精度はハーネスの差分チェックとは別の評価器で、全条件を同じ基準で測る。ハーネスが見ていない viewport や状態（held-out）を必ず含め、「検査対象にだけ合わせた」実装を見分けられるようにする。

描画環境：

- Playwright 公式の Docker イメージをバージョン固定で使う。フォントはリポジトリ同梱のものを入れる
- deviceScaleFactor は正解画像の書き出し倍率に合わせる。`reducedMotion: 'reduce'`、キャレット非表示、`document.fonts.ready` を待ってから撮影する
- worktree をビルドしてコンテナ内で配信し、`eval.json` の URL とルート要素を要素スクショで撮る
- 同じコードを 2 回評価して同じスコアになること（決定性）を最初に確かめる

`tasks/<task>/eval.json` の例：

```json
{
  "url": "/iframe.html?id=nanami-card--default",
  "root": "[data-nanami-root]",
  "cases": [
    { "viewport": [1440, 900], "state": "default", "reference": "reference/pc-default.png", "heldOut": false },
    { "viewport": [375, 812],  "state": "default", "reference": "reference/sp-default.png", "heldOut": false },
    { "viewport": [768, 1024], "state": "default", "reference": "reference/tab-default.png", "heldOut": true },
    { "viewport": [1440, 900], "state": "hover",   "reference": "reference/pc-hover.png",   "heldOut": true, "action": { "hover": "[data-nanami-root] a" } }
  ]
}
```

`data-nanami-root` のような撮影用の目印は、エージェントに付けさせるとそれ自体がヒントになる。そのため、お題の Story（またはルート）側にあらかじめ置いておき、エージェントはその中にコンポーネントを配置するだけにする。

| 指標 | 算出 | 備考 |
| --- | --- | --- |
| diff_ratio | pixelmatch（threshold 0.1）の差分ピクセル数 ÷ 総ピクセル数 | 差分ヒートマップ PNG も保存 |
| ssim | グレースケールで SSIM | アンチエイリアスの影響を受けにくい |
| size_delta_px | 正解と実装の幅・高さの差の合計 | サイズが違うときは左上揃えで余白を埋めてから比較 |
| token_adherence | 変更された CSS 宣言のうち、色・余白・フォント系の値が `var(--…)` を使っている割合 | final.patch から算出。c0・c1 でも計測する |

完了判定は Sena の目視なので、スコアによる合否は付けない。レポートでは「目視 OK だったランのスコア分布」を出し、目視と数値のずれも見えるようにする。

## 集計とレポート

`analysis/ingest.ts` が `runs/*` を読んで DuckDB に入れ直し（毎回作り直しでよい）、`views.sql` のビューで指標を出す。n が小さいので、比較は平均ではなく中央値と範囲で見せる。

エージェント稼働時間の定義（各プロンプトから、次のプロンプトまでの間にある最後の Stop まで）：

```sql
CREATE VIEW run_agent_time AS
WITH p AS (
  SELECT run_id, ts AS start_ts,
         LEAD(ts) OVER (PARTITION BY run_id ORDER BY ts) AS next_ts
  FROM events WHERE kind = 'user_prompt'
)
SELECT p.run_id,
       SUM(date_diff('millisecond', p.start_ts, s.stop_ts)) / 1000.0 AS agent_active_sec
FROM p,
LATERAL (
  SELECT MAX(e.ts) AS stop_ts FROM events e
  WHERE e.run_id = p.run_id AND e.kind = 'stop'
    AND e.ts > p.start_ts AND (p.next_ts IS NULL OR e.ts < p.next_ts)
) s
WHERE s.stop_ts IS NOT NULL
GROUP BY p.run_id;
```

他のビュー：

- `run_summary`：ランごとに稼働時間・総経過時間・追加指示数（ラベル別）・トークン 4 種・推定コスト・評価スコア（全体 / held-out のみ）・outcome
- `condition_summary`：条件 × お題ごとの中央値・最小・最大、成功率
- `tool_timeline`：events をラン開始からの経過秒に直し、category・phase・round 付きで並べたもの
- `first_use`：category ごとの初回使用時刻と、そのときの phase（「ハーネスを初めて使ったのは実装前か後か」を見る）
- 推定コストはモデル別単価を `nanami.config.json` に持たせて計算し、単価の参照日も記録する

レポートは `report/build.ts` が DuckDB から静的 HTML を生成する。チャートは Observable Plot などの軽いライブラリで十分。

| 画面 | 見せるもの | 形 |
| --- | --- | --- |
| 比較ビュー | 条件×指標の中央値と範囲 | 条件ごとの点＋ヒゲ（お題ごとに並べる） |
| 比較ビュー | トークン内訳 | 4 種の積み上げ棒＋推定コスト |
| 比較ビュー | 追加指示の種別内訳と成功率 | 積み上げ棒。technical が 0 で完了したランの割合を強調 |
| ラン詳細 | 時間軸のスイムレーン | 人間の指示・ツール呼び出し（category で色分け）・compact を別レーンに |
| ラン詳細 | 差分の収束 | ハーネス実行ごとの diff_ratio の折れ線（c1・c2） |
| ラン詳細 | 最終結果 | 正解・実装・差分ヒートマップの 3 枚並びを case ごとに。held-out には印 |
| ラン詳細 | 追加指示の全文とラベル | 表 |

## 構築ステップとチェックリスト

収集と評価を先に作り、スモークランでデータの正しさを確かめてからレポートに進む。各ステップの構築プロンプトは次の節にある。

- [x] Step 0：このドキュメントを Markdown でエクスポートし、`nanami/docs/nanami-design.md` に置く
- [ ] Step 1：骨組みと隔離環境。完了条件：実験用設定で起動した Claude Code が、条件外の skills・MCP を認識しない
- [ ] Step 2：hooks ロガー。完了条件：全種類のイベントが events.jsonl に出る。transcript にロガー由来の文字列が混入していない
- [ ] Step 3：runner（plan / start / finish / label）。完了条件：1 ラン分の runs/<run_id>/ が揃う
- [ ] Step 4：ingest とビュー。完了条件：トークン合計が `/cost` の表示と一致、稼働時間が手計測と数秒以内で一致
- [ ] Step 5：ハーネスのログ出力。完了条件：c1 のランで harness.jsonl が実行回数分たまる。エージェントが見る出力は変わらない
- [ ] Step 6：独立評価器。完了条件：同じコードを 2 回評価して同一スコア。正解画像そのものを入れると diff_ratio が 0
- [ ] Step 7：お題 3 つの整備（prompt.md / spec.md / reference / eval.json、撮影用 Story）
- [ ] Step 8：スモークラン（S お題 × 3 条件 × 1 回）。データの抜け、分類漏れ（other が多い）、介入ルールの運用しにくさを見直す
- [ ] Step 9：レポート生成
- [ ] Step 10：本番実行（27 ラン）。実行中は条件ファイル・お題・ツールの版を変えない

## Claude Code 用 構築プロンプト集

構築は普段の Claude Code 環境で `nanami` リポジトリを作業対象にして行う。実験用の隔離環境は計測対象のランにだけ使う。各ステップは別セッションで、下のプロンプトをそのまま貼る。

### Step 1：骨組みと隔離環境

```text
docs/nanami-design.md の「環境の固定と隔離」「リポジトリ構成とデータスキーマ」を読んで、nanami の骨組みを作って。

やること：
- ディレクトリ構成と nanami.config.json の型定義・読み込み
- 実験用 Claude Code を起動する関数：CLAUDE_CONFIG_DIR を .claude-config に向け、自動更新を止め、モデルを指定し、NANAMI_HOME / NANAMI_RUN_ID / NANAMI_RUN_DIR を渡す
- conditions/c0-none, c1-pw, c2-tokens-pw の雛形（中身は空でよい）

完了条件：
- 起動関数経由で立ち上げた Claude Code に「使える skills と MCP を全部挙げて」と聞いて、普段のグローバル設定由来のものが出ない手順を README に書く（確認は私がやる）

着手前に計画と質問を出して。
```

### Step 2：hooks ロガー

```text
docs/nanami-design.md の「データ収集 > hooks ロガー」に従って hooks/log-event.ts と、全条件共通の hooks 設定を作って。

要件：
- stdin の JSON に受信時刻（ISO8601、ミリ秒）と NANAMI_RUN_ID を足して $NANAMI_RUN_DIR/events.jsonl に 1 行追記
- stdout には何も出さない。常に exit 0。例外は logger-errors.log へ
- NANAMI_RUN_DIR が無ければ即終了
- tool_response は先頭 2KB とバイト数だけ残す
- 条件ごとの settings.json と共通 hooks をマージする関数

完了条件：
- テスト用のダミー入力で各 hook_event_name が正しく記録されるユニットテスト
- stdout が空であることを検証するテスト
- 1 回の実行時間を計測して報告

着手前に計画と質問を出して。
```

### Step 3：runner

```text
docs/nanami-design.md の「実験プロトコル」に従って runner の CLI（nanami plan / start / finish / label）を作って。

- plan：お題 × 条件 × 回数を、同じお題が連続しないようシャッフルして schedule.csv に出す（seed 指定可）
- start：schedule の次の行（または指定）で run_id を発行。sandbox の基準コミットから git worktree を作り、条件ファイルと hooks を配置、meta.json を書き、prompt.md をクリップボードにコピーしてから実験用 Claude Code を起動。worktree 内に計測用ファイルは置かない
- finish：outcome（success / timeout / gave_up）を対話で受け取り、events.jsonl の transcript_path から本体とサブエージェントの JSONL を transcript/ にコピー、final.patch を保存し、評価器を呼ぶ（評価器は後で作るので今はスタブ）
- label：未ラベルの追加指示を 1 件ずつ表示し、visual / reference / nudge / spec / technical / env から選ばせて labels.json に保存
- start 中に経過時間と追加指示回数を監視し、60 分または追加指示 10 回で通知だけ出す（強制終了はしない）

完了条件：ダミーの sandbox で start → 手動で 1 往復 → finish を通し、runs/<run_id>/ に設計どおりのファイルが揃う手順を示す。
着手前に計画と質問を出して。
```

### Step 4：ingest とビュー

```text
docs/nanami-design.md の「データスキーマ」「データ収集 > transcript / ツール分類」「集計とレポート」に従って analysis/ingest.ts と views.sql を作って。

- runs/* を読み、nanami.duckdb を毎回作り直す
- llm_calls は message.id で重複除去し、isSidechain を保持
- events に classify.json で category、設計の定義で phase と round を付与
- prompts は user_prompt イベントと labels.json から
- ビュー：run_agent_time（設計の SQL をそのまま）、run_summary、condition_summary、tool_timeline、first_use
- 読めなかった行数と category=other の件数を最後に表示

完了条件：実際の 1 ランで、トークン合計を /cost の表示と突き合わせる手順を出す。合わなければ原因を調べて報告。
着手前に計画と質問を出して。
```

### Step 5：ハーネスのログ出力

```text
conditions/c1-pw と c2-tokens-pw の Playwright ハーネスに、docs/nanami-design.md の「ハーネス自身のログ」を入れて。

- NANAMI_RUN_DIR があるときだけ harness.jsonl に {ts, viewport, state, diff_ratio, passed} を追記
- ハーネスがエージェントに返す出力は 1 バイトも変えない

完了条件：変更前後でハーネスの stdout/stderr が同一であることを確かめるテスト。
着手前に、既存ハーネスの構造を読んだうえで計画を出して。
```

### Step 6：独立評価器

```text
docs/nanami-design.md の「独立評価器」に従って eval/ を作って。

- Playwright 公式 Docker イメージ（バージョン固定）で、指定した worktree をビルド・配信し、tasks/<task>/eval.json の各 case を撮影
- フォント同梱、reducedMotion、キャレット非表示、fonts.ready 待ち
- diff_ratio（pixelmatch, threshold 0.1）、ssim、size_delta_px、token_adherence（final.patch の CSS から）を scores.json に、差分ヒートマップを PNG で保存
- nanami finish から呼べるようにする

完了条件：
- 同じコードを 2 回評価してスコアが一致
- 正解画像そのものを表示するダミーページで diff_ratio = 0
着手前に計画と質問を出して。
```

### Step 7：お題の整備

```text
tasks/<task>/ の雛形を作って。中身は私が書くので、埋めるべき項目をテンプレートとチェックリストで示してほしい。

- prompt.md：全条件共通の初回プロンプト。条件固有のツール名を含めない
- spec.md：実装先のパスと Story、状態と viewport、正解画像の場所（held-out 用の画像はエージェントに渡さない）
- eval.json：設計の例に従う
- sandbox 側の撮影用 Story（data-nanami-root を持つラッパーを事前に用意）

あわせて、prompt.md と spec.md を読んで「条件によって有利不利が生まれる書き方」がないかレビューする手順も書いて。
```

### Step 9：レポート

```text
docs/nanami-design.md の「集計とレポート」の画面表に従って、report/build.ts で nanami.duckdb から静的 HTML を生成して。

- 比較ビュー（index.html）とラン詳細（runs/<run_id>.html）
- 比較は中央値＋範囲。平均だけの表示はしない
- スイムレーンは稼働区間と人間待ち区間を背景色で分ける
- 画像は runs/<run_id>/eval/ を相対参照。外部通信なしで開けること
- チャートライブラリは軽いものを 1 つに絞る

完了条件：スモークラン 3 件で生成し、各画面のスクショを Playwright で撮って見せて。
着手前に画面構成の案を出して。
```
