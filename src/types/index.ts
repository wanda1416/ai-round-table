/**
 * Shared type definitions for AI Round Table.
 */

// ─── Discussion ────────────────────────────────────────────

/** 讨论状态 */
export type DiscussionStatus =
  | "idle"       // 未开始
  | "running"    // 进行中
  | "paused"     // 已暂停
  | "consensus"  // 已达成共识
  | "stopped";   // 已终止

/** 讨论会话 */
export interface RoundTable {
  id: string;
  topic: string;
  status: DiscussionStatus;
  participants: Participant[];
  messages: DebateMessage[];
  round: number;
  consensusScore?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Participant ───────────────────────────────────────────

/** 参与者状态 */
export type ParticipantStatus = "active" | "waiting" | "error";

/** 支持的 AI 平台 */
export type Platform = "chatgpt" | "kimi" | "gemini" | "deepseek" | "grok";

/** 参与者（每个 AI） */
export interface Participant {
  id: string;
  platform: Platform;
  tabId: number;
  name: string;
  status: ParticipantStatus;
}

// ─── Messages ──────────────────────────────────────────────

/** 消息类型 */
export type MessageType =
  | "opening"     // 开场观点
  | "response"    // 回应
  | "rebuttal"    // 反驳
  | "concession"  // 让步
  | "summary";    // 总结

/** 辩论消息 */
export interface DebateMessage {
  id: string;
  roundTableId: string;
  participantId: string;
  round: number;
  content: string;
  type: MessageType;
  targets?: string[];
  timestamp: number;
}

// ─── Messages between extension components ─────────────────

/** Content Script → Background: 内容脚本注册自身 */
export interface ContentScriptRegister {
  type: "content:register";
  platform: Platform;
}

/** Background → Content Script: 注入消息到 AI 对话框并发送 */
export interface InjectMessage {
  type: "inject:message";
  text: string;
}

/** Background → Content Script: 只注入文本到输入框，不发送（用于转发上下文） */
export interface InjectOnly {
  type: "inject:only";
  text: string;
}

/** Content Script → Background: AI 回复完成 */
export interface AIResponseReady {
  type: "ai:response";
  text: string;
}

/** Background → Content Script: 读取 AI 的最新回复 */
export interface ReadResponse {
  type: "read:response";
}

/** Background → Content Script: 检测 AI 是否正在生成回复 */
export interface CheckGenerating {
  type: "check:generating";
}

/** Background → Content Script: 等待 AI 回复完成 */
export interface WaitResponse {
  type: "wait:response";
  timeout?: number;
}

/** Background → Content Script: 等待用户手动发送（只注入不发送，等用户点发送） */
export interface SubmitManual {
  type: "submit:manual";
  text: string;
  timeout?: number;
}

/** Content Script → Background: 生成状态 */
export interface GeneratingStatus {
  type: "generating:status";
  isGenerating: boolean;
}

/** 所有 Content Script 接收的消息 */
export type ContentScriptMessage =
  | InjectMessage
  | InjectOnly
  | ReadResponse
  | CheckGenerating
  | WaitResponse
  | SubmitManual;

/** Popup → Background: 查询已注册的参与者列表 */
export interface GetParticipants {
  type: "popup:getParticipants";
}

/** Popup → Background: 开始讨论 */
export interface StartDiscussion {
  type: "discussion:start";
  topic: string;
}

/** Popup → Background: 终止讨论 */
export interface StopDiscussion {
  type: "discussion:stop";
}

/** Popup/Panel → Background: 设置自动提交模式 */
export interface SetAutoSubmit {
  type: "discussion:setAutoSubmit";
  autoSubmit: boolean;
}

/** Background → Popup: 返回参与者列表 */
export interface ParticipantInfo {
  tabId: number;
  platform: Platform;
}

/** Background → Popup: 讨论状态更新 */
export interface DiscussionUpdate {
  type: "discussion:update";
  status: DiscussionStatus;
  round: number;
  currentSpeaker?: string;
  log?: string;
}

/** 所有 Background 接收的消息 */
export type BackgroundMessage =
  | ContentScriptRegister
  | AIResponseReady
  | GeneratingStatus
  | GetParticipants
  | StartDiscussion
  | StopDiscussion
  | SetAutoSubmit;

/** 所有 Popup 接收的消息 */
export type PopupMessage = DiscussionUpdate;
