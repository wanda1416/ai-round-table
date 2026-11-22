/**
 * ChatGPT Adapter — chatgpt.com 的 DOM 交互实现。
 *
 * 选择器策略（按优先级）：
 * - 输入框: #prompt-textarea → div[contenteditable="true"]
 * - 发送按钮: button[data-testid="send-button"] → form button 最后一个
 * - 回复容器: div[data-message-author-role="assistant"]
 * - 生成状态: 检测 stop 按钮是否存在
 */

import type { PlatformAdapter } from "./types";
import { setContentEditableText, sleep, waitFor, defaultWaitForManualSend } from "./types";

export class ChatGPTAdapter implements PlatformAdapter {
  readonly platform = "chatgpt" as const;

  async injectText(text: string): Promise<void> {
    const input = this.findInput();
    if (!input) throw new Error("[ChatGPT] 找不到输入框");
    setContentEditableText(input, text);
    await sleep(100);
  }

  async send(): Promise<void> {
    // 优先用 data-testid，fallback 到 form 内最后一个 button
    const btn =
      document.querySelector('button[data-testid="send-button"]') ??
      this.findSendButton();
    if (!btn) throw new Error("[ChatGPT] 找不到发送按钮");
    (btn as HTMLButtonElement).click();
  }

  async readLastResponse(): Promise<string> {
    const messages = document.querySelectorAll(
      'div[data-message-author-role="assistant"]',
    );
    if (messages.length === 0) return "";
    const last = messages[messages.length - 1];
    return last.textContent?.trim() ?? "";
  }

  async isGenerating(): Promise<boolean> {
    // ChatGPT 在生成时会显示 stop 按钮（圆形停止图标）
    const stopBtn =
      document.querySelector('button[data-testid="stop-button"]') ??
      document.querySelector('button[aria-label="Stop streaming"]') ??
      document.querySelector('[data-testid="stop-button"]');
    return !!stopBtn;
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

  // ─── Private ────────────────────────────────────────────

  private findInput(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("#prompt-textarea") ??
      document.querySelector<HTMLElement>('div[contenteditable="true"][role="textbox"]') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  }

  private findSendButton(): HTMLElement | null {
    // form 内最后一个可点击的 button
    const form = document.querySelector("form");
    if (!form) return null;
    const buttons = form.querySelectorAll(
      'button[type="submit"], button:not([type="button"])',
    );
    return (buttons[buttons.length - 1] as HTMLElement) ?? null;
  }
}
