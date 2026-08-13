/**
 * Gemini Adapter — gemini.google.com 的 DOM 交互实现。
 *
 * 选择器策略：
 * - 输入框: .ql-editor / rich-textarea / div[contenteditable="true"]
 * - 发送按钮: button[aria-label*="Send"] / send-button
 * - 回复容器: .response-container / model-response
 * - 生成状态: 检测 stop button / loading indicator
 */

import type { PlatformAdapter } from "./types";
import { setContentEditableText, sleep, waitFor, defaultWaitForManualSend } from "./types";

export class GeminiAdapter implements PlatformAdapter {
  readonly platform = "gemini" as const;

  async injectText(text: string): Promise<void> {
    const input = this.findInput();
    if (!input) throw new Error("[Gemini] 找不到输入框");

    // Gemini 使用 Quill 编辑器，需要特殊处理
    if (input.classList.contains("ql-editor")) {
      input.focus();
      input.innerHTML = `<p>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      setContentEditableText(input, text);
    }
    await sleep(100);
  }

  async send(): Promise<void> {
    const btn = this.findSendButton();
    if (!btn) throw new Error("[Gemini] 找不到发送按钮");
    btn.click();
  }

  async readLastResponse(): Promise<string> {
    // Gemini 的回复容器
    const selectors = [
      ".model-response-text",
      ".response-container",
      'message-content[class*="model"]',
      ".markdown-main-panel",
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        const text = last.textContent?.trim();
        if (text) return text;
      }
    }
    return "";
  }

  async isGenerating(): Promise<boolean> {
    // Gemini 生成中会有 stop 按钮或 animated indicator
    const indicators = [
      'button[aria-label*="Stop"]',
      'button[data-test-id="stop-button"]',
      ".loading-indicator",
      'button[aria-label*="取消"]',
    ];
    for (const sel of indicators) {
      const el = document.querySelector(sel);
      if (el && (el as HTMLElement).offsetParent !== null) return true;
    }
    return false;
  }

  async waitForResponse(timeout = 120_000): Promise<string> {
    await sleep(1000);
    await waitFor(async () => !(await this.isGenerating()), timeout, 800);
    await sleep(300);
    return this.readLastResponse();
  }

  async waitForManualSend(timeout = 300_000): Promise<void> {
    await defaultWaitForManualSend(() => this.isGenerating(), timeout);
  }

  private findInput(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(".ql-editor") ??
      document.querySelector<HTMLElement>(".rich-textarea") ??
      document.querySelector<HTMLElement>('div[contenteditable="true"][aria-label]') ??
      document.querySelector<HTMLElement>(".input-area-field div[contenteditable='true']") ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  }

  private findSendButton(): HTMLElement | null {
    const selectors = [
      'button[aria-label*="Send"]',
      'button[data-test-id="send-button"]',
      'button[aria-label="Send message"]',
      ".send-button",
    ];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }
}
