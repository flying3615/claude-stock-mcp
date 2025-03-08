import fs from 'fs';
import path from 'path';
import * as os from 'node:os';

/**
 * 日志记录器
 * 重写控制台方法，将输出重定向到文件而不是控制台，
 * 避免干扰Claude Desktop的输出处理
 */
export class Logger {
  private static initialized = false;
  private static logFile: string;

  // 保存原始控制台方法
  private static originalConsoleLog = console.log;
  private static originalConsoleError = console.error;
  private static originalConsoleWarn = console.warn;
  private static originalConsoleInfo = console.info;
  private static originalConsoleDebug = console.debug;

  /**
   * 初始化日志记录器
   * @param silentMode 当为true时，即使在开发环境也不会有控制台输出
   */
  static init(silentMode = false) {
    if (this.initialized) return;

    // 记录是否为静默模式
    const isSilent = silentMode;

    let logDir;

    try {
      // 首先尝试在当前工作目录创建logs目录
      logDir = path.resolve('./logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      try {
        // 如果失败，尝试在用户目录创建
        logDir = path.join(os.homedir(), '.claude-stock-mcp', 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
      } catch (error2) {
        // 最后尝试在临时目录创建
        logDir = path.join(os.tmpdir(), 'claude-stock-mcp-logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
      }
    }

    // 创建日志文件
    this.logFile = path.join(
      logDir,
      `claude-mcp-${new Date().toISOString().split('T')[0]}.log`
    );

    // 重写控制台方法
    console.log = (...args) => {
      this.writeToLogFile('LOG', args);
      // 如果不是静默模式且是开发环境，才输出到控制台
      if (!isSilent && process.env.NODE_ENV === 'development') {
        this.originalConsoleLog(...args);
      }
    };

    console.error = (...args) => {
      this.writeToLogFile('ERROR', args);
      if (!isSilent && process.env.NODE_ENV === 'development') {
        this.originalConsoleError(...args);
      }
    };

    console.warn = (...args) => {
      this.writeToLogFile('WARN', args);
      if (!isSilent && process.env.NODE_ENV === 'development') {
        this.originalConsoleWarn(...args);
      }
    };

    console.info = (...args) => {
      this.writeToLogFile('INFO', args);
      if (!isSilent && process.env.NODE_ENV === 'development') {
        this.originalConsoleInfo(...args);
      }
    };

    console.debug = (...args) => {
      this.writeToLogFile('DEBUG', args);
      if (!isSilent && process.env.NODE_ENV === 'development') {
        this.originalConsoleDebug(...args);
      }
    };

    this.initialized = true;

    // 记录初始化信息
    console.info(
      'Logger initialized. Console output redirected to log file:',
      this.logFile
    );
  }

  /**
   * 写入日志文件
   */
  private static writeToLogFile(level: string, args: any[]) {
    if (!this.logFile) return; // 安全检查

    try {
      // 格式化参数，处理对象、错误等特殊类型
      const formattedArgs = args
        .map(arg => {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
          } else if (arg === null) {
            return 'null';
          } else if (arg === undefined) {
            return 'undefined';
          } else if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return '[Object cannot be stringified]';
            }
          } else {
            return String(arg);
          }
        })
        .join(' ');

      // 创建带时间戳的日志条目
      const logEntry = `[${level}] ${new Date().toISOString()}: ${formattedArgs}\n`;

      // 尝试写入日志文件
      fs.appendFileSync(this.logFile, logEntry);
    } catch (e) {
      // 写入失败时，尝试使用备用方法或静默失败
      // 这里不使用console方法，以避免递归调用
      try {
        const fallbackLog = path.join(
          os.tmpdir(),
          'claude-stock-mcp-fallback.log'
        );
        fs.appendFileSync(fallbackLog, `Log write failed: ${e}\n`);
      } catch {
        // 完全静默失败 - 最后的防线
      }
    }
  }

  /**
   * 恢复原始控制台方法
   */
  static restore() {
    if (!this.initialized) return;

    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.info = this.originalConsoleInfo;
    console.debug = this.originalConsoleDebug;

    this.initialized = false;
  }
}
