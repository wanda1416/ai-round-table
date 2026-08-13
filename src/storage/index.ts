/**
 * Storage 持久化层 — 使用 chrome.storage.local 保存讨论数据。
 *
 * 存储内容：
 * - 讨论历史（每次完整讨论的记录）
 * - 当前讨论状态（用于跨 Popup 开关恢复）
 * - 用户设置
 */

import type { DebateMessage, DiscussionStatus, ParticipantInfo } from "../types";

// ─── 数据结构 ──────────────────────────────────────────────

/** 一次完整的讨论记录 */
export interface DiscussionRecord {
  id: string;
  topic: string;
  status: DiscussionStatus;
  participants: ParticipantInfo[];
  messages: DebateMessage[];
  round: number;
  createdAt: number;
  updatedAt: number;
}

/** 全局存储结构 */
export interface StorageData {
  /** 讨论历史列表 */
  history: DiscussionRecord[];
  /** 当前进行中的讨论（如果有） */
  currentDiscussion: {
    topic: string;
    status: DiscussionStatus;
    round: number;
    currentSpeaker?: string;
    logs: string[];
    updatedAt: number;
  } | null;
  /** 用户设置 */
  settings: {
    maxRounds: number;
    panelPosition: { x: number; y: number };
    panelCollapsed: boolean;
  };
}

// ─── 默认值 ──────────────────────────────────────────────

const DEFAULT_DATA: StorageData = {
  history: [],
  currentDiscussion: null,
  settings: {
    maxRounds: 5,
    panelPosition: { x: 20, y: 20 },
    panelCollapsed: false,
  },
};

// ─── 读写 ──────────────────────────────────────────────────

/** 读取完整存储数据 */
export async function loadData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(null);
  // 合并默认值（防止新增字段时丢失）
  return {
    ...DEFAULT_DATA,
    ...result,
    settings: { ...DEFAULT_DATA.settings, ...(result.settings ?? {}) },
  };
}

/** 保存完整存储数据 */
export async function saveData(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

// ─── 讨论历史 ──────────────────────────────────────────────

/** 保存一次完成的讨论到历史 */
export async function saveDiscussion(record: DiscussionRecord): Promise<void> {
  const data = await loadData();
  // 更新或追加
  const idx = data.history.findIndex((h) => h.id === record.id);
  if (idx >= 0) {
    data.history[idx] = record;
  } else {
    data.history.unshift(record); // 最新的在前
  }
  // 最多保留 50 条历史
  if (data.history.length > 50) {
    data.history = data.history.slice(0, 50);
  }
  await saveData({ history: data.history });
}

/** 获取讨论历史列表 */
export async function getHistory(): Promise<DiscussionRecord[]> {
  const data = await loadData();
  return data.history;
}

// ─── 当前讨论状态（实时同步） ──────────────────────────────

/** 更新当前讨论状态（供 Background 调用） */
export async function updateCurrentDiscussion(
  update: StorageData["currentDiscussion"],
): Promise<void> {
  await saveData({ currentDiscussion: update });
}

/** 获取当前讨论状态 */
export async function getCurrentDiscussion(): Promise<StorageData["currentDiscussion"]> {
  const data = await loadData();
  return data.currentDiscussion;
}

/** 清除当前讨论（讨论结束后调用） */
export async function clearCurrentDiscussion(): Promise<void> {
  await saveData({ currentDiscussion: null });
}

// ─── 设置 ──────────────────────────────────────────────────

/** 更新设置 */
export async function updateSettings(
  settings: Partial<StorageData["settings"]>,
): Promise<void> {
  const data = await loadData();
  await saveData({ settings: { ...data.settings, ...settings } });
}

/** 获取设置 */
export async function getSettings(): Promise<StorageData["settings"]> {
  const data = await loadData();
  return data.settings;
}
