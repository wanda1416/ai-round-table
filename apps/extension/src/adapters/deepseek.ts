/**
 * DeepSeek Adapter — chat.deepseek.com 的 DOM 交互实现。
 *
 * 选择器策略：
 * - 输入框: textarea / #chat-input
 * - 发送按钮: button[class*="send"] / 输入区域旁的按钮
 * - 回复容器: .ds-markdown / .message-assistant
 * - 生成状态: 检测 stop 按钮 / 加载动画
 */

import type { PlatformAdapter } from "./types";
import { setInputValue, sleep, waitFor, defaultWaitForManualSend } from "./types";

export class DeepSeekAdapter implements PlatformAdapter {
  readonly platform = "deepseek" as const;

  async injectText(text: string): Promise<void> {
    const input = this.findInput();
    if (!input) throw new Error("[DeepSeek] 找不到输入框");

    if (input instanceof HTMLTextAreaElement) {
      setInputValue(input, text);
    } else {
      input.focus();
      (input as HTMLInputElement).value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await sleep(100);
  }

  async send(): Promise<void> {
    const btn = this.findSendButton();
    if (!btn) throw new Error("[DeepSeek] 找不到发送按钮");
    btn.click();
  }

  async readLastResponse(): Promise<string> {
    const selectors = [
      ".ds-markdown",
      '.message-row-assistant .markdown-body',
      '[class*="message-content"]',
      ".markdown-body",
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
    const indicators = [
      'button[aria-label="停止"]',
      'button[aria-label="Stop"]',
      '[class*="stop-btn"]',
      '[class*="pause-btn"]',
      '.ds-icon-stop',
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
      document.querySelector<HTMLTextAreaElement>("textarea") ??
      document.querySelector<HTMLElement>("#chat-input") ??
      document.querySelector<HTMLElement>('[class*="chat-input"]')
    );
  }

  private findSendButton(): HTMLElement | null {
    const selectors = [
      'button[aria-label="发送"]',
      'button[aria-label="Send"]',
      '[class*="send-btn"]',
      '[class*="send-button"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }
}
