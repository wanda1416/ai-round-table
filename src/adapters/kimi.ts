/**
 * Kimi Adapter — kimi.com 的 DOM 交互实现。
 *
 * 选择器策略：
 * - 输入框: div[contenteditable="true"] / #chat-input
 * - 发送按钮: 输入区域附近的发送按钮
 * - 回复容器: .message-item.assistant / div[data-role="assistant"]
 * - 生成状态: 检测加载指示器 / stop 按钮
 */

import type { PlatformAdapter } from "./types";
import { setContentEditableText, sleep, waitFor, defaultWaitForManualSend } from "./types";

export class KimiAdapter implements PlatformAdapter {
  readonly platform = "kimi" as const;

  async injectText(text: string): Promise<void> {
    const input = this.findInput();
    if (!input) throw new Error("[Kimi] 找不到输入框");
    setContentEditableText(input, text);
    await sleep(100);
  }

  async send(): Promise<void> {
    const btn = this.findSendButton();
    if (!btn) throw new Error("[Kimi] 找不到发送按钮");
    btn.click();
  }

  async readLastResponse(): Promise<string> {
    const messages = document.querySelectorAll(
      '.message-item[data-role="assistant"], .assistant-message, div[data-role="assistant"]',
    );
    if (messages.length === 0) return "";
    const last = messages[messages.length - 1];
    return last.textContent?.trim() ?? "";
  }

  async isGenerating(): Promise<boolean> {
    // Kimi 生成中会显示 stop 按钮或加载动画
    const indicators = document.querySelectorAll(
      '[class*="stop"], [class*="loading"], [class*="generating"], [aria-label*="停止"]',
    );
    // 过滤：只保留可见的
    for (const el of indicators) {
      if ((el as HTMLElement).offsetParent !== null) return true;
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
      document.querySelector<HTMLElement>("#chat-input") ??
      document.querySelector<HTMLElement>('#chat-input textarea') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"][data-testid]') ??
      document.querySelector<HTMLElement>('.input-area div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  }

  private findSendButton(): HTMLElement | null {
    // 尝试多种选择器
    const selectors = [
      'button[aria-label="发送"]',
      'button[aria-label="Send"]',
      '[class*="send-btn"]',
      '[class*="send-button"]',
      '.input-area button:last-child',
    ];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }
}
