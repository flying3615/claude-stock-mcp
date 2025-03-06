#!/bin/bash

# Claude Stock Analysis MCP 安装脚本

echo "============================================"
echo "  Claude Stock Analysis MCP 安装助手"
echo "============================================"

# 确定用户主目录
USER_HOME=$(eval echo ~$USER)
CLAUDE_CONFIG_DIR="$USER_HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
CURRENT_DIR=$(pwd)

# 检查Node.js环境
echo "检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js (v16+)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "错误: Node.js版本过低，需要v16或更高版本"
    echo "当前版本: $(node -v)"
    exit 1
fi

echo "Node.js版本: $(node -v) ✓"

# 安装依赖
echo "安装项目依赖..."
npm install

# 构建项目
echo "构建项目..."
npm run build

# 配置Claude Desktop
echo "配置Claude Desktop..."

# 确保Claude配置目录存在
mkdir -p "$CLAUDE_CONFIG_DIR"

# 准备配置文件内容
MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "stock-analysis": {
      "command": "node $CURRENT_DIR/dist/index.js"
    }
  }
}
EOF
)

# 如果配置文件不存在，直接创建
if [ ! -f "$CLAUDE_CONFIG_FILE" ]; then
    echo "$MCP_CONFIG" > "$CLAUDE_CONFIG_FILE"
    echo "已创建Claude Desktop配置: $CLAUDE_CONFIG_FILE"
else
    # 检查现有配置是否已包含我们的服务器
    if grep -q "stock-analysis" "$CLAUDE_CONFIG_FILE"; then
        echo "Claude Desktop配置已包含stock-analysis服务器，无需修改"
    else
        # 检查文件是否为有效JSON
        if jq empty "$CLAUDE_CONFIG_FILE" 2>/dev/null; then
            # 备份原始配置
            cp "$CLAUDE_CONFIG_FILE" "${CLAUDE_CONFIG_FILE}.backup"
            echo "已备份原始配置到: ${CLAUDE_CONFIG_FILE}.backup"
            
            # 将我们的配置与现有配置合并
            TMP_CONFIG=$(mktemp)
            jq --argjson new "$(echo $MCP_CONFIG | jq .mcpServers)" '.mcpServers = (.mcpServers // {}) + $new' "$CLAUDE_CONFIG_FILE" > "$TMP_CONFIG"
            mv "$TMP_CONFIG" "$CLAUDE_CONFIG_FILE"
            echo "已更新Claude Desktop配置"
        else
            echo "警告: 现有配置文件不是有效的JSON，创建新文件"
            echo "$MCP_CONFIG" > "$CLAUDE_CONFIG_FILE"
        fi
    fi
fi

# 确保report目录存在
mkdir -p "trading-reports"

echo ""
echo "============================================"
echo "  安装完成！"
echo "============================================"
echo ""
echo "现在您需要:"
echo "1. 重启Claude Desktop应用程序"
echo "2. 查看工具栏中的锤子图标，确认MCP服务器已加载"
echo ""
echo "使用方法:"
echo "- 在Claude Desktop中询问'帮我分析苹果股票'等问题"
echo "- 使用'查询任务状态'获取分析结果"
echo ""
echo "若要手动启动服务器，运行:"
echo "npm start"
echo ""
