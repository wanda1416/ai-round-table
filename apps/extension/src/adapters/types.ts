/**
 * PlatformAdapter — 每个 AI 平台的 DOM 交互抽象。
 *
 * 每个 Adapter 实现这组方法，Content Script 根据当前平台委托给对应实现。
 * 所有方法都是 async 的，因为 DOM 操作可能需要等待（如轮询生成状态）。
 */

import type { Platform } from "../types";

export interface PlatformAdapter {
  /** 平台标识 */
  readonly platform: Platform;

  /**
   * 向输入框注入文本。
   * 需要触发 React/Vue 等框架的输入事件，让页面感知到内容变化。
   */
  injectText(text: string): Promise<void>;

  /**
   * 触发发送（点击发送按钮或模拟 Enter 键）。
   */
  send(): Promise<void>;

  /**
   * 读取页面上 AI 最后一条回复的文本内容。
   */
  readLastResponse(): Promise<string>;

  /**
   * 检测 AI 是否正在生成回复（流式输出中）。
   */
  isGenerating(): Promise<boolean>;

  /**
   * 等待 AI 回复完成。轮询 isGenerating() 直到返回 false。
   * @param timeout 超时毫秒数，默认 60s
   * @returns AI 的完整回复文本
   */
  waitForResponse(timeout?: number): Promise<string>;

  /**
   * 等待用户手动点击发送。
   * 检测逻辑：先等 AI 开始生成（stop 按钮出现），再等生成完毕。
   * @param timeout 超时毫秒数，默认 300s（用户可能需要时间思考）
   */
  waitForManualSend(timeout?: number): Promise<void>;
}

/**
 * 通用工具函数：等待指定毫秒。
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 通用工具函数：轮询等待条件成立。
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 60_000,
  interval = 500,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await sleep(interval);
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * 通用 waitForManualSend 实现。
 * 先等 AI 开始生成（用户点了发送），再等生成完毕。
 */
export async function defaultWaitForManualSend(
  isGenerating: () => Promise<boolean>,
  timeout = 300_000,
): Promise<void> {
  // 先等 AI 开始生成（用户手动点了发送按钮）
  await waitFor(async () => isGenerating(), timeout, 500);
  // 再等生成完毕
  await waitFor(async () => !(await isGenerating()), 120_000, 800);
  await sleep(300);
}

/**
 * 通用工具函数：通过 input event 设置 contenteditable 元素的文本。
 * 适用于 ChatGPT、Kimi 等使用 contenteditable div 作为输入框的平台。
 */
export function setContentEditableText(element: HTMLElement, text: string): void {
  element.focus();

  // 清空现有内容
  element.innerHTML = "";

  // 使用 execCommand 或 InputEvent 来触发框架的响应
  // 先尝试现代 API
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", text);

  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer,
  });
  element.dispatchEvent(pasteEvent);

  // 如果 paste 没有生效（某些框架不监听 paste），直接设置 innerHTML
  if (!element.textContent?.trim()) {
    element.innerHTML = `<p>${escapeHtml(text)}</p>`;
    // 触发 input 事件让 React 感知
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/**
 * 通用工具函数：通过原生 input 事件设置 textarea/input 的文本。
 */
export function setInputValue(
  element: HTMLTextAreaElement | HTMLInputElement,
  text: string,
): void {
  // React 拦截了原生 value setter，需要用原型链上的 setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value",
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, text);
  } else {
    element.value = text;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
