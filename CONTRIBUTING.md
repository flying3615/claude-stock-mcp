# Claude Stock Analysis MCP 贡献指南

感谢您考虑为 Claude Stock Analysis MCP 项目做出贡献！本文档提供了如何参与项目贡献的指南。

## 开发环境设置

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/claude-stock-mcp.git
   cd claude-stock-mcp
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 在开发模式下运行：
   ```bash
   npm run dev
   ```

## 代码结构

- `src/index.ts` - 项目入口点
- `src/mcp/` - MCP服务器实现
- `src/analysis/` - 股票分析核心功能
- `src/util/` - 工具函数

## 添加新功能

1. 创建一个新分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. 实现您的功能或修复
   - 添加新的分析功能应放在 `src/analysis/` 目录
   - 添加新的MCP工具应在 `src/mcp/mcp-server.ts` 文件中定义

3. 确保代码能够通过现有测试：
   ```bash
   npm test
   ```

4. 在本地构建项目并确保它能正常工作：
   ```bash
   npm run build
   npm start
   ```

5. 提交更改：
   ```bash
   git add .
   git commit -m "添加新功能：您的功能描述"
   ```

## 代码规范

- 使用TypeScript编写所有新代码
- 遵循现有的代码格式和命名规范
- 为公共API添加JSDoc注释
- 尽可能利用TypeScript的类型系统，避免使用`any`

## 提交PR流程

1. 将您的分支推送到GitHub：
   ```bash
   git push origin feature/your-feature-name
   ```

2. 在GitHub上创建一个Pull Request，清楚描述您的更改内容和目的

3. 等待代码审查，并根据反馈进行必要的修改

## 集成现有的股票分析代码

如果您希望集成更多股票分析功能：

1. 确保添加必要的类型定义 
2. 遵循现有的分析接口规范
3. 更新相关文档
4. 考虑增加选项来控制分析的参数

感谢您的贡献！
