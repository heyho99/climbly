graph TD
    %% --- 1. 登場人物の定義 ---
    Client["クライアント"]
    
    BFF["<b>BFF (APIの司令塔)</b>"]

    subgraph "マイクロサービス群"
        direction LR
        UserService["ユーザー・権限サービス"]
        TaskService["タスクサービス"]
        RecordService["実績記録サービス"]
    end

    %% --- 2. API呼び出しのフローを定義 ---
    
    %% フローA: タスク一覧表示
    Client -- "タスク一覧をリクエスト" --> BFF
    BFF -- "① 権限のあるタスクIDを問い合わせ" --> UserService
    BFF -- "② タスク詳細を問い合わせ" --> TaskService
    BFF -- "③ (結果を集約して) レスポンス" --> Client
    
    %% フローB: 実績記録
    Client -- "作業実績を記録" --> BFF
    BFF -- "④ 実績記録を依頼" --> RecordService
    RecordService -- "⑤ サブタスクの存在を確認" --> TaskService


    %% --- 3. スタイル定義 ---
    classDef bff fill:#cde4f9,stroke:#333,stroke-width:2px;
    class BFF bff;