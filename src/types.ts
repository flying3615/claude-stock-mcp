/**
 * 公共类型定义
 */

/**
 * 蜡烛图数据
 */
export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

/**
 * MCP工具响应类型
 */
export interface ToolResult {
  status: 'success' | 'error';
  result?: any;
  error?: string;
}

/**
 * 分析结果类型
 */
export interface AnalysisResult {
  id: string;
  symbol: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime: Date;
  reportPath?: string;
}
