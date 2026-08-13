# AI Round Table - Roadmap

> 让多个 AI 围绕一个话题展开辩论，插件负责调度发言、传递观点、推动共识。

## 项目愿景

用户在浏览器中打开多个 AI 平台（ChatGPT、Kimi、Gemini、DeepSeek、Grok 等），插件自动：
1. 接收用户输入的话题
2. 向每个 AI 发送初始观点请求
3. 读取每个 AI 的回复
4. 将 A 的观点转发给 B、C、D，要求它们回应
5. 循环往复，直到达成共识或用户终止

## 核心挑战

| 挑战 | 说明 |
|------|------|
| **跨平台读写** | 每个 AI 平台的 DOM 结构、API 不同，需要 adapter 模式 |
| **消息注入** | 如何模拟用户输入并触发发送？（DOM 操作 vs API 拦截） |
| **响应检测** | 如何知道 AI 已经回复完毕？（流式输出检测、加载状态监听） |
| **讨论协议** | 轮次管理、消息路由、防重复、超时处理 |
| **共识判断** | 如何判断 AI 们已经达成一致？（语义分析 / 显式投票） |

## 技术架构（初步）

```
┌─────────────────────────────────────────────────────────┐
│                    Popup / Side Panel                     │
│  [话题输入] [开始/暂停/终止] [讨论日志] [共识进度]        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Background Service Worker                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Discussion  │  │   Message    │  │   Consensus    │  │
│  │ Orchestrator│  │   Router     │  │   Detector     │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Content Scripts (per tab)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ ChatGPT  │ │   Kimi   │ │  Gemini  │ │ DeepSeek │    │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │ │ Adapter  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 数据结构（复用 ai-chat-exporter 的 Schema）

参考 `ai-chat-exporter/packages/schema`，核心实体：

```typescript
// 讨论会话
interface RoundTable {
  id: string;
  topic: string;           // 讨论话题
  status: "idle" | "running" | "paused" | "consensus" | "stopped";
  participants: Participant[];
  messages: DebateMessage[];
  round: number;           // 当前轮次
  consensusScore?: number; // 共识度 0-1
}

// 参与者（每个 AI）
interface Participant {
  id: string;
  platform: string;        // "chatgpt" | "kimi" | "gemini" | ...
  tabId: number;           // 浏览器 tab id
  name: string;            // 显示名称
  status: "active" | "waiting" | "error";
}

// 辩论消息
interface DebateMessage {
  id: string;
  roundTableId: string;
  participantId: string;   // 谁说的
  round: number;
  content: string;         // 消息内容
  type: "opening" | "response" | "rebuttal" | "concession" | "summary";
  targets?: string[];      // 回应谁的观点（participantId[]）
  timestamp: number;
}
```

## Roadmap

### Phase 1: 基础设施 + 单平台验证 (v0.1)

**目标**：验证核心流程可行，先支持 ChatGPT 单平台双窗口对聊。

- [ ] 项目脚手架（Manifest V3、TypeScript、Vite、pnpm）
- [ ] Background Service Worker 基础框架
- [ ] Popup UI 基础框架（话题输入、开始/停止按钮）
- [ ] ChatGPT Adapter v1
  - [ ] 检测 ChatGPT 页面
  - [ ] 读取 AI 回复（DOM 解析）
  - [ ] 注入消息并发送（模拟输入）
  - [ ] 检测回复完成（加载状态）
- [ ] 简单编排器
  - [ ] 话题 → AI-A → 读取回复 → 转发给 AI-B → 读取回复 → 循环
- [ ] 讨论日志（Popup 中显示消息流）

**里程碑**：两个 ChatGPT 标签页能围绕话题自动对聊 3 轮。

---

### Phase 2: 多平台 Adapter (v0.2)

**目标**：支持 3+ 平台，验证 Adapter 抽象层的通用性。

- [ ] Adapter 抽象接口定义
  ```typescript
  interface PlatformAdapter {
    detect(): boolean;
    readLastResponse(): Promise<string>;
    injectMessage(text: string): Promise<void>;
    waitForResponse(timeout: number): Promise<string>;
    isResponding(): boolean;
  }
  ```
- [ ] Kimi Adapter
- [ ] GeminiAdapter
- [ ] DeepSeekAdapter
- [ ] Tab 管理增强
  - [ ] 自动检测已打开的 AI 标签页
  - [ ] 手动绑定标签页到参与者
- [ ] 消息格式标准化（system prompt 注入角色设定）

**里程碑**：ChatGPT + Kimi + Gemini 三方讨论，能完成 5 轮对话。

---

### Phase 3: 讨论协议增强 (v0.3)

**目标**：让讨论更有序、更有深度。

- [ ] 轮次管理策略
  - [ ] 轮流发言（Round-Robin）
  - [ ] 自由辩论（任意 AI 可回应任意观点）
  - [ ] 主持人模式（指定一个 AI 做总结/引导）
- [ ] System Prompt 模板库
  - [ ] 辩论者角色
  - [ ] 调和者角色
  - [ ] 专家角色
- [ ] 消息路由规则
  - [ ] "请 @ChatGPT 回应这个观点"
  - [ ] 选择性转发（只转发相关观点）
- [ ] 超时与错误处理
  - [ ] AI 长时间未响应 → 重试/跳过
  - [ ] 平台限流检测

**里程碑**：支持 3 种讨论模式，讨论过程可控。

---

### Phase 4: 共识检测 (v0.4)

**目标**：自动判断 AI 是否达成共识。

- [ ] 共识检测策略
  - [ ] 显式投票：让每个 AI 表态 "同意/反对/保留"
  - [ ] 语义相似度：比较最近 N 轮观点的 embedding 距离
  - [ ] 关键词检测：检测 "同意"、"达成共识" 等信号词
- [ ] 共识进度条（Popup UI）
- [ ] 共识报告生成
  - [ ] 各方立场摘要
  - [ ] 分歧点列表
  - [ ] 最终共识声明
- [ ] 讨论导出（Markdown / JSON）

**里程碑**：讨论能自动终止并输出共识报告。

---

### Phase 5: 体验优化 (v0.5)

**目标**：产品化，易用性提升。

- [ ] Side Panel UI（替代 Popup，持久显示）
- [ ] 实时讨论可视化
  - [ ] 消息气泡流
  - [ ] 参与者状态指示
  - [ ] 共识度热力图
- [ ] 讨论模板
  - [ ] "正方 vs 反方"
  - [ ] "头脑风暴"
  - [ ] "专家圆桌"
- [ ] 用户介入机制
  - [ ] 随时插入新问题
  - [ ] 修改 AI 观点后再转发
  - [ ] 调整讨论方向
- [ ] 历史记录
  - [ ] 保存过去的讨论
  - [ ] 恢复/继续讨论

**里程碑**：可演示的产品，非技术用户也能使用。

---

### Phase 6: 高级功能 (v1.0+)

- [ ] GrokAdapter / ClaudeAdapter（通过 API 或第三方客户端）
- [ ] 多语言讨论（中/英/日...）
- [ ] 讨论评分（逻辑性、说服力、贡献度）
- [ ] 自定义 AI 角色/人格
- [ ] 观众模式（用户作为观察者，AI 自动讨论）
- [ ] Chrome Web Store 发布

## 开发原则

1. **Adapter 模式**：每个平台的差异封装在 Adapter 内，核心逻辑不感知平台
2. **非侵入式**：不修改 AI 平台的任何数据，只通过 DOM 操作交互
3. **用户可控**：随时暂停、终止、介入讨论
4. **渐进增强**：先跑通单平台，再逐步扩展

## 技术栈（初步）

| 组件 | 选型 |
|------|------|
| 构建工具 | Vite + CRXJS (Chrome Extension) |
| 语言 | TypeScript |
| 包管理 | pnpm |
| UI 框架 | React + Tailwind (Popup/SidePanel) |
| 状态管理 | Zustand |
| 测试 | Vitest |

## 与 ai-chat-exporter 的关系

- **复用**：Schema 设计思路、Adapter 架构理念
- **不复用**：代码层面不直接依赖（浏览器插件是独立项目）
- **参考**：各平台 Adapter 的实现经验（DOM 结构、API 特征）
