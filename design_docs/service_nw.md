graph TD
    Client[クライアント]
    
    subgraph bff [BFF]
	    BFF-port["bff:80<br/>dev(8081:80)"]
    end
    subgraph front [フロントエンド]
	    Front-port["front:80<br/>dev(8080:80)"]
    end    
    subgraph task-service [タスクサービス]
	    Task-port["task-service:80<br/>dev(8082:80)"]
    end
    subgraph user-service [ユーザー・権限サービス]
	    User-port["user-service:80<br/>dev(8083:80)"]
    end
    subgraph record-service [実績記録サービス]
	    Record-port["record-service:80<br/>dev(8084:80)"]
    end
    
    subgraph task-db [タスクDB]
	    task-db-port["task-db:5432<br/>dev(5502:5432)"]
        tasks
        subtasks
        daily_work_plans
        daily_time_plans
    end
    subgraph user-db [ユーザ・権限DB]
	    user-db-port["user-db:5432<br/>dev(5501:5432)"]
        users
        task_auths
    end
    subgraph record-db [実績記録DB]
	    record-db-port["record-db:5432<br/>dev(5503:5432)"]
        record_works
    end

             
    Client <--> Front-port
    Front-port <--> BFF-port
    
    BFF-port <--> User-port
    BFF-port <--> Task-port
    BFF-port <--> Record-port
    
    task-service <--> task-db-port
    task-db-port <--> tasks
    task-db-port <--> subtasks
    task-db-port <--> daily_work_plans
    task-db-port <--> daily_time_plans
    
    user-service <--> user-db-port
    user-db-port <--> users
    user-db-port <--> task_auths
    
    record-service <--> record-db-port
    record-db-port <--> record_works