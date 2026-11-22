/**
 * Background Service Worker — AI Round Table 的编排中心。
 *
 * 职责：
 * 1. 管理 Content Script 的注册（哪些 AI 标签页在线）
 * 2. 编排讨论流程（轮次、消息路由）
 * 3. 维护讨论状态，推送更新到 Popup
 */

import type {
  BackgroundMessage,
  DiscussionStatus,
  ParticipantInfo,
  Platform,
} from "../types";
import { updateCurrentDiscussion, clearCurrentDiscussion, saveDiscussion, type DiscussionRecord } from "../storage";

// ─── 注册的 Content Script 列表 ────────────────────────────

const registeredTabs = new Map<number, Platform>();

// ─── 讨论状态 ──────────────────────────────────────────────

let discussionStatus: DiscussionStatus = "idle";
let currentRound = 0;
let discussionLog: string[] = [];
let discussionTopic = "";
let discussionId = "";
let autoSubmit = true; // 默认自动提交，用户可在悬浮窗切换

/** 获取当前状态（避免 TS 类型收窄） */
function getStatus(): DiscussionStatus {
  return discussionStatus;
}

// ─── 工具函数 ──────────────────────────────────────────────

/** 向指定 tab 的 Content Script 发送消息并等待响应 */
function sendToTab<T>(tabId: number, message: object): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}

/** 同步当前状态到 storage */
function syncToStorage(): void {
  updateCurrentDiscussion({
    topic: discussionTopic,
    status: discussionStatus,
    round: currentRound,
    logs: [...discussionLog],
    updatedAt: Date.now(),
  });
}

/** 向所有 Content Script 广播状态更新 */
function broadcastUpdate(extra?: Partial<{ status: DiscussionStatus; round: number; currentSpeaker: string; log: string }>): void {
  const update = {
    type: "discussion:update" as const,
    status: discussionStatus,
    round: currentRound,
    ...extra,
  };
  // 广播给所有 extension 页面
  chrome.runtime.sendMessage(update).catch(() => {
    // Popup 可能没打开，忽略
  });
}

function addLog(msg: string): void {
  discussionLog.push(msg);
  broadcastUpdate({ log: msg });
  syncToStorage();
}

/** 获取所有已注册的参与者 */
function getParticipants(): ParticipantInfo[] {
  return Array.from(registeredTabs.entries()).map(([tabId, platform]) => ({
    tabId,
    platform,
  }));
}

// ─── 讨论编排 ──────────────────────────────────────────────

/**
 * 向指定 tab 注入消息并等待 AI 回复。
 */
async function askAI(tabId: number, platform: string, prompt: string): Promise<string> {
  addLog(`[${platform}] 发送: ${prompt.slice(0, 60)}...`);

  // 注入消息并发送
  const injectResult = await sendToTab<{ ok?: boolean; error?: string }>(
    tabId,
    { type: "inject:message", text: prompt },
  );
  if (injectResult?.error) {
    throw new Error(`[${platform}] 注入失败: ${injectResult.error}`);
  }

  // 等待 AI 回复完成
  addLog(`[${platform}] 等待回复...`);
  const response = await sendToTab<{ text?: string; error?: string }>(
    tabId,
    { type: "wait:response", timeout: 120_000 },
  );
  if (response?.error) {
    throw new Error(`[${platform}] 等待回复失败: ${response.error}`);
  }

  const text = response?.text ?? "";
  addLog(`[${platform}] 回复: ${text.slice(0, 80)}...`);
  return text;
}

/**
 * 第一轮：向每个 AI 发送话题，收集初始观点。
 */
async function runFirstRound(
  participants: ParticipantInfo[],
  topic: string,
): Promise<{ platform: string; text: string }[]> {
  const responses: { platform: string; text: string }[] = [];
  const prompt = `我们来做一个圆桌讨论。话题是：\n\n${topic}\n\n请你作为参与者之一，先发表你的观点。请直接发表，不需要寒暄。`;

  for (const p of participants) {
    if (getStatus() === "stopped") break;
    broadcastUpdate({ currentSpeaker: p.platform });
    try {
      const text = await askAI(p.tabId, p.platform, prompt);
      responses.push({ platform: p.platform, text });
    } catch (err) {
      addLog(`[${p.platform}] 错误: ${(err as Error).message}`);
    }
  }
  return responses;
}

/**
 * 后续轮次：把其他人上一轮的最新回复注入到每个 AI 的对话中，并请求回应。
 * 因为每个 AI 的网页本身就有完整对话历史，所以不需要重复发送旧消息。
 */
async function runFollowUpRound(
  participants: ParticipantInfo[],
  lastRoundResponses: { platform: string; text: string }[],
): Promise<{ platform: string; text: string }[]> {
  const responses: { platform: string; text: string }[] = [];

  for (const p of participants) {
    if (getStatus() === "stopped") break;
    broadcastUpdate({ currentSpeaker: p.platform });

    // 把其他人（非自己）的最新回复合并成一条消息，转发并请求回应
    const others = lastRoundResponses.filter((r) => r.platform !== p.platform);
    const combinedText = others
      .map((r) => `【${r.platform}】：\n${r.text}`)
      .join("\n\n---\n\n");

    try {
      addLog(`[${p.platform}] ← 转发 ${others.length} 条回复`);
      const msg = `以下是其他参与者的最新观点：\n\n${combinedText}\n\n请你对以上观点做出回应。可以赞同、反驳或补充，目标是逐步达成共识。`;

      if (autoSubmit) {
        // 自动提交：注入 + 发送，然后等 AI 回复
        await sendToTab(p.tabId, { type: "inject:message", text: msg });
        addLog(`[${p.platform}] 等待回复...`);
        const response = await sendToTab<{ text?: string; error?: string }>(
          p.tabId,
          { type: "wait:response", timeout: 120_000 },
        );
        if (response?.error) throw new Error(response.error);
        const text = response?.text ?? "";
        addLog(`[${p.platform}] 回复: ${text.slice(0, 80)}...`);
        responses.push({ platform: p.platform, text });
      } else {
        // 手动提交：注入文本，等用户手动点发送，等生成完毕
        addLog(`[${p.platform}] 等待手动提交...`);
        await sendToTab(p.tabId, {
          type: "submit:manual",
          text: msg,
          timeout: 300_000,
        });
        // 用户发送后，读取 AI 回复
        addLog(`[${p.platform}] 等待回复...`);
        const response = await sendToTab<{ text?: string; error?: string }>(
          p.tabId,
          { type: "wait:response", timeout: 120_000 },
        );
        if (response?.error) throw new Error(response.error);
        const text = response?.text ?? "";
        addLog(`[${p.platform}] 回复: ${text.slice(0, 80)}...`);
        responses.push({ platform: p.platform, text });
      }
    } catch (err) {
      addLog(`[${p.platform}] 错误: ${(err as Error).message}`);
    }
  }

  return responses;
}

/**
 * 主讨论循环。
 */
async function runDiscussion(topic: string, maxRounds = 5): Promise<void> {
  const participants = getParticipants();
  if (participants.length < 2) {
    addLog("错误: 至少需要 2 个参与者才能开始讨论");
    discussionStatus = "idle";
    broadcastUpdate();
    return;
  }

  addLog(`讨论开始！话题: ${topic}`);
  addLog(`参与者: ${participants.map((p) => p.platform).join(", ")}`);

  discussionStatus = "running";
  broadcastUpdate();

  // 第一轮：发话题
  addLog(`── 第 1 轮（初始观点）──`);
  broadcastUpdate();
  let lastRoundResponses = await runFirstRound(participants, topic);

  // 后续轮次：转发 + 回应
  for (let round = 1; round < maxRounds; round++) {
    if (getStatus() === "stopped") break;

    currentRound = round + 1;
    addLog(`── 第 ${currentRound} 轮 ──`);
    broadcastUpdate();

    lastRoundResponses = await runFollowUpRound(participants, lastRoundResponses);

    if (getStatus() === "stopped") break;

    if (round < maxRounds - 1) {
      addLog("本轮结束，3 秒后开始下一轮...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (getStatus() !== "stopped") {
    discussionStatus = "consensus";
    addLog("讨论完成！");
  }
  // 保存到历史
  const record: DiscussionRecord = {
    id: discussionId,
    topic: discussionTopic,
    status: discussionStatus,
    participants: getParticipants(),
    messages: [],
    round: currentRound,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveDiscussion(record);
  clearCurrentDiscussion();
  broadcastUpdate();
}

// ─── 消息处理 ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const msg = message as BackgroundMessage;

  // Popup 查询参与者列表
  if (msg.type === "popup:getParticipants") {
    sendResponse({ participants: getParticipants() });
    return false;
  }

  // Popup 开始讨论
  if (msg.type === "discussion:start") {
    if (discussionStatus === "running") {
      sendResponse({ error: "讨论正在进行中" });
      return false;
    }
    discussionTopic = msg.topic;
    discussionId = `rt-${Date.now()}`;
    currentRound = 0;
    discussionLog = [];
    // 异步启动讨论
    runDiscussion(msg.topic);
    sendResponse({ ok: true });
    return false;
  }

  // Popup 终止讨论
  if (msg.type === "discussion:stop") {
    discussionStatus = "stopped";
    addLog("用户终止了讨论");
    broadcastUpdate();
    sendResponse({ ok: true });
    return false;
  }

  // 设置自动提交模式
  if (msg.type === "discussion:setAutoSubmit") {
    autoSubmit = msg.autoSubmit;
    addLog(`提交模式: ${autoSubmit ? "自动" : "手动"}`);
    sendResponse({ ok: true });
    return false;
  }

  // Content Script 注册
  const tabId = sender.tab?.id;
  if (tabId != null) {
    switch (msg.type) {
      case "content:register":
        registeredTabs.set(tabId, msg.platform);
        console.log(`[RoundTable] Tab ${tabId} registered as ${msg.platform}`);
        break;
      case "ai:response":
        console.log(`[RoundTable] AI response from tab ${tabId}:`, msg.text);
        break;
      case "generating:status":
        console.log(`[RoundTable] Tab ${tabId} generating: ${msg.isGenerating}`);
        break;
    }
  }

  sendResponse({ ok: true });
  return false;
});

// ─── 生命周期 ──────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  if (registeredTabs.has(tabId)) {
    registeredTabs.delete(tabId);
    console.log(`[RoundTable] Tab ${tabId} unregistered`);
  }
});

chrome.runtime.onStartup.addListener(() => {
  registeredTabs.clear();
  discussionStatus = "idle";
  currentRound = 0;
  discussionLog = [];
  console.log("[RoundTable] Background service worker started");
});

console.log("[RoundTable] Background service worker loaded");
