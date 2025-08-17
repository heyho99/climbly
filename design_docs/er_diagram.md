erDiagram
    users ||--o{ tasks : "作成する"
    users||--o{ task_auths : "持つ"
    tasks ||--o{ task_auths : "関連付ける"
    tasks ||--o{ subtasks : "持つ"
    tasks ||--o{ daily_work_plans : "持つ"
    tasks ||--o{ daily_time_plans : "持つ"
    subtasks ||--o{ record_works : "記録する"

    users {
        int user_id PK
        varchar username
        varchar password
        varchar email "ログイン通知やパスワードリセット用"
        boolean is_active "無効化フラグ"
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
    }
    
    task_auths {
        int task_auth_id PK
        int task_id FK
        int user_id FK "ユーザ毎にタスクの権限持つ"
        varchar task_user_auth "read/write/admin"
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }
    
    tasks {
        int task_id PK
        int created_by FK "user_id"
        varchar task_name
        text task_content
        timestamp start_at "日時に対応"
        timestamp end_at "日時に対応"
        varchar category "study/creation/other"
        int target_time
        text comment
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }
    
    subtasks {
        int subtask_id PK
        int task_id FK
        int created_by FK "user_id"
        varchar subtask_name
        int contribution_value
        text comment
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }
    
    record_works {
        int record_work_id PK
        int subtask_id FK
        int created_by FK "実績入力した人"
        timestamp worked_at "日時に対応"
        int completion_rate "サブタスク完了率"
        int work_time "作業時間（分など）"
        text note "作業メモ"
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }
    
    daily_time_plans {
        int daily_time_plan_id PK
        int task_id FK
        int created_by FK
        date target_date "カレンダー連携必要無いのでdate"
        int time_plan_value "整数値で計算簡単に"
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }
    
    daily_work_plans {
        int daily_work_plan_id PK
        int task_id FK
        int created_by FK
        date target_date "カレンダー連携必要無いのでdate"
        int task_plan_value "整数値で計算簡単に"
        int last_updated_user FK
        timestamp created_at
        timestamp updated_at
    }