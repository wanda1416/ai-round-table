import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "AI Round Table",
  version: "0.1.0",
  description:
    "让浏览器中的多个 AI 围绕一个话题展开辩论，自动调度发言、传递观点、推动共识。",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "AI Round Table",
  },
  background: {
    service_worker: "src/background/index.ts",
  },
  content_scripts: [
    {
      matches: [
        "https://chatgpt.com/*",
        "https://www.kimi.com/*",
        "https://gemini.google.com/*",
        "https://chat.deepseek.com/*",
        "https://grok.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "tabs", "scripting"],
});
