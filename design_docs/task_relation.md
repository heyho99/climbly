## タスクの進捗率の算出
```mermaid
graph TD

subgraph ta [Task A]
  進捗率:44%
end

subgraph sta1 [Subtask A1]
  contribution_value:20
  サブタスクの進捗率:70%
end

subgraph sta2 [Subtask A2]
  contribution_value:50
  サブタスクの進捗率:60%
end

subgraph sta3 [Subtask A3]
  contribution_value:30
  サブタスクの進捗率:0%
end

subgraph rwa1a [Record A1a]
  progress_value:10
end

subgraph rwa1b [Record A1b]
  progress_value:20
end

subgraph rwa1c [Record A1c]
  progress_value:40
end

subgraph rwa2a [Record A2a]
  progress_value:50
end

subgraph rwa2b [Record A2b]
  progress_value:10
end

ta---|20*0.7=14|sta1
ta---|50*0.6=30|sta2
ta---|30*0=0|sta3

sta2---rwa2a
sta2---rwa2b

sta1---rwa1a
sta1---rwa1b
sta1---rwa1c
```

## 凡例と前提

- __contribution_value__: サブタスクのタスク進捗への寄与度（重み）。タスク内合計は100。
- __progress_value__: 実績入力時の進捗差分（%）。サブタスクで累積（最大100%）。
- 図中の `20*0.7=14` は「寄与度20 × サブタスク進捗70% = タスクへの寄与14pt」を意味。
- A1のサブタスク進捗70%は `10 + 20 + 40 = 70` から計算。A2の60%は `50 + 10 = 60` から計算。

## 数式（定義）

- サブタスク進捗（%）
  - `subtask_progress = clamp( Σ record_works.progress_value, 0, 100 )`
- タスク進捗（%）
  - `task_progress = Σ( subtask_progress_s × contribution_value_s ) / 100`

## バリデーションと業務ルール

- __寄与度合計__: 同一タスク配下の `contribution_value` 合計=100 必須。
- __進捗差分範囲__: `progress_value` は 0〜100（差分）。負値不可。
- __累積上限__: サブタスク累積は100でクランプ（超過分は無視）。
- __再計算__: 実績の作成/更新/削除時にサブタスク→タスク進捗を再計算。

## 予定と実績の対比（参考）

- 時間: `Σ record_works.work_time` と `tasks.target_time` を比較して達成率を算出。
- 件数/ポイント: `daily_work_plans`、時間: `daily_time_plans` をダッシュボードで予定対実績の比較に利用（`design_docs/er_diagram.md` 参照）。

## タスクの作業時間の算出
```mermaid
graph TD

subgraph ta [Task A]
  タスクの作業時間:450分
  target_time:900分
  作業時間の達成率...450/900...50%
end

subgraph sta1 [Subtask A1]
  サブタスクの作業時間:340分
end

subgraph sta2 [Subtask A2]
  サブタスクの作業時間:110分
end

subgraph sta3 [Subtask A3]
  サブタスクの作業時間:0分
end

subgraph rwa1a [Record A1a]
  work_time:100
end

subgraph rwa1b [Record A1b]
  work_time:40
end

subgraph rwa1c [Record A1c]
  work_time:200
end

subgraph rwa2a [Record A2a]
  work_time:110
end

ta---sta1
ta---sta2
ta---sta3

sta2---rwa2a

sta1---rwa1a
sta1---rwa1b
sta1---rwa1c
```