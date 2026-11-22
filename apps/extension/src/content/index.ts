/**
 * Content Script — 注入到每个 AI 平台的标签页中。
 *
 * 职责：
 * 1. 向 Background 注册自身（声明所在平台）
 * 2. 接收 Background 指令，委托给 PlatformAdapter 执行
 * 3. 返回执行结果给 Background
 */

import type { ContentScriptMessage, Platform } from "../types";
import { getAdapter } from "../adapters";
import { mountPanel } from "../panel/mount";

// ─── 平台检测 ──────────────────────────────────────────────

function detectPlatform(): Platform | null {
  const host = location.hostname;
  if (host.includes("chatgpt.com")) return "chatgpt";
  if (host.includes("kimi.com")) return "kimi";
  if (host.includes("gemini.google.com")) return "gemini";
  if (host.includes("chat.deepseek.com")) return "deepseek";
  if (host.includes("grok.com")) return "grok";
  return null;
}

// ─── 注册 ──────────────────────────────────────────────────

const platform = detectPlatform();

if (platform) {
  chrome.runtime.sendMessage({
    type: "content:register",
    platform,
  });
  console.log(`[RoundTable] Content script loaded on ${platform}`);

  // 挂载悬浮窗
  mountPanel();
} else {
  console.warn("[RoundTable] Unknown platform, content script idle");
}

// ─── 消息处理 ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ContentScriptMessage, _sender, sendResponse) => {
    if (!platform) {
      sendResponse({ error: "unknown platform" });
      return false;
    }

    const adapter = getAdapter(platform);

    // 所有操作都是 async 的，返回 true 表示异步响应
    switch (message.type) {
      case "inject:message":
        adapter
          .injectText(message.text)
          .then(() => adapter.send())
          .then(() => sendResponse({ ok: true }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true; // 异步响应

      case "inject:only":
        // 只注入文本到输入框，不发送（用于转发其他 AI 的回复作为上下文）
        adapter
          .injectText(message.text)
          .then(() => sendResponse({ ok: true }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;

      case "read:response":
        adapter
          .readLastResponse()
          .then((text) => sendResponse({ text }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;

      case "check:generating":
        adapter
          .isGenerating()
          .then((isGenerating) => sendResponse({ isGenerating }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;

      case "wait:response":
        adapter
          .waitForResponse(message.timeout)
          .then((text) => sendResponse({ text }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;

      case "submit:manual":
        // 注入文本，然后等待用户手动点击发送，再等待生成完毕
        adapter
          .injectText(message.text)
          .then(() => adapter.waitForManualSend(message.timeout))
          .then(() => sendResponse({ ok: true }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;
    }

    return false;
  },
);
