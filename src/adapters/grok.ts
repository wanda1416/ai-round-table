/**
 * Grok Adapter — grok.com 的 DOM 交互实现。
 *
 * 选择器策略：
 * - 输入框: textarea / div[contenteditable="true"]
 * - 发送按钮: button 在输入区域下方
 * - 回复容器: 消息列表中的 assistant 消息
 * - 生成状态: 检测 stop 按钮 / streaming indicator
 */

import type { PlatformAdapter } from "./types";
import { setContentEditableText, setInputValue, sleep, waitFor, defaultWaitForManualSend } from "./types";

export class GrokAdapter implements PlatformAdapter {
  readonly platform = "grok" as const;

  async injectText(text: string): Promise<void> {
    const input = this.findInput();
    if (!input) throw new Error("[Grok] 找不到输入框");

    if (input instanceof HTMLTextAreaElement) {
      setInputValue(input, text);
    } else {
      setContentEditableText(input, text);
    }
    await sleep(100);
  }

  async send(): Promise<void> {
    const btn = this.findSendButton();
    if (!btn) throw new Error("[Grok] 找不到发送按钮");
    btn.click();
  }

  async readLastResponse(): Promise<string> {
    // Grok 的消息结构
    const selectors = [
      '[data-testid="text-container"]',
      ".markdown",
      '[class*="response-text"]',
      '[class*="message-content"]',
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
      'button[aria-label="Stop"]',
      'button[data-testid="stop-button"]',
      '[class*="stop"]',
      '[class*="generating"]',
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
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>('[class*="input"] [contenteditable]')
    );
  }

  private findSendButton(): HTMLElement | null {
    const selectors = [
      'button[aria-label="Send"]',
      'button[data-testid="send-button"]',
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
