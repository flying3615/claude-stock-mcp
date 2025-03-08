import crypto from 'crypto';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 任务类型
export interface Task {
  id: string;
  status: TaskStatus;
  startTime: Date;
  result?: any;
  error?: string;
}

// 任务管理器
export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  // 创建新任务
  createTask(): string {
    const taskId = crypto.randomBytes(4).toString('hex');
    this.tasks.set(taskId, {
      id: taskId,
      status: TaskStatus.PENDING,
      startTime: new Date(),
    });
    return taskId;
  }

  // 获取任务状态
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  // 更新任务为运行状态
  setTaskRunning(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.RUNNING;
    }
  }

  // 更新任务为完成状态
  setTaskCompleted(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.result = result;
    }
  }

  // 更新任务为失败状态
  setTaskFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      task.error = error;
    }
  }

  // 清理过期任务 (可选: 添加定时器来清理长时间完成的任务)
  cleanupTasks(olderThanHours: number = 24): void {
    const now = new Date();
    for (const [taskId, task] of this.tasks.entries()) {
      const taskAge =
        (now.getTime() - task.startTime.getTime()) / (1000 * 60 * 60);
      if (
        (task.status === TaskStatus.COMPLETED ||
          task.status === TaskStatus.FAILED) &&
        taskAge > olderThanHours
      ) {
        this.tasks.delete(taskId);
      }
    }
  }

  /**
   * 启动异步任务包装函数
   * @param taskFn 要异步执行的任务函数
   * @param logger 日志记录器（可选）
   * @returns 任务ID
   */
  startAsyncTask<T>(
    taskFn: () => Promise<T>,
    logger?: { info: (msg: string) => void; error: (msg: string) => void }
  ): string {
    // 创建新任务
    const taskId = this.createTask();

    // 默认日志处理
    const log = logger || {
      info: (msg: string) => console.log(msg),
      error: (msg: string) => console.error(msg),
    };

    // 启动异步任务
    (async () => {
      try {
        this.setTaskRunning(taskId);
        log.info(`开始执行异步任务，任务ID: ${taskId}`);

        // 执行传入的任务函数
        const result = await taskFn();

        // 保存任务结果
        this.setTaskCompleted(taskId, result);
        log.info(`异步任务完成，任务ID: ${taskId}`);
      } catch (error) {
        // 处理错误
        log.error(`异步任务失败, 任务ID: ${taskId}, 错误: ${error}`);
        this.setTaskFailed(
          taskId,
          error instanceof Error ? error.message : String(error)
        );
      }
    })().catch(error => {
      log.error(`异步任务执行出错, 任务ID: ${taskId}, 错误: ${error}`);
      this.setTaskFailed(
        taskId,
        error instanceof Error ? error.message : String(error)
      );
    });

    return taskId;
  }
}
