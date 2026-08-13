/**
 * Adapter 注册表 — 根据平台名获取对应的 Adapter 实例。
 */

import type { Platform } from "../types";
import type { PlatformAdapter } from "./types";
import { ChatGPTAdapter } from "./chatgpt";
import { KimiAdapter } from "./kimi";
import { GeminiAdapter } from "./gemini";
import { DeepSeekAdapter } from "./deepseek";
import { GrokAdapter } from "./grok";

export type { PlatformAdapter } from "./types";

/** 单例缓存 */
const adapters = new Map<Platform, PlatformAdapter>();

/**
 * 获取指定平台的 Adapter 实例。
 */
export function getAdapter(platform: Platform): PlatformAdapter {
  let adapter = adapters.get(platform);
  if (adapter) return adapter;

  switch (platform) {
    case "chatgpt":
      adapter = new ChatGPTAdapter();
      break;
    case "kimi":
      adapter = new KimiAdapter();
      break;
    case "gemini":
      adapter = new GeminiAdapter();
      break;
    case "deepseek":
      adapter = new DeepSeekAdapter();
      break;
    case "grok":
      adapter = new GrokAdapter();
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }

  adapters.set(platform, adapter);
  return adapter;
}
