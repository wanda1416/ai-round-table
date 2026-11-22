# AI Round Table

多 AI 讨论项目的统一仓库。当前仅统一 Git 仓库，两个子项目保持独立，不共享依赖、构建配置或业务代码。

## 子项目

- [`apps/ai-agent`](apps/ai-agent)：API 网页版。配置 OpenAI、Claude、Gemini 或兼容接口，让多个 Agent 围绕话题讨论并生成共识结论。
- [`apps/extension`](apps/extension)：Chrome 插件版。驱动浏览器中已有的 AI 标签页传递观点并推动讨论。

## 独立开发

### API 网页版

```powershell
cd apps/ai-agent
npm ci
npm run dev
```

### Chrome 插件版

```powershell
cd apps/extension
pnpm install
pnpm dev
```

各子项目的说明和构建命令以各自目录内的文档及 `package.json` 为准。
