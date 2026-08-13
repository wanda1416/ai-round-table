import { useState, useEffect, useRef, useCallback } from "react";
import type { DiscussionStatus, DiscussionUpdate, ParticipantInfo } from "../types";
import {
  loadData,
  updateCurrentDiscussion,
  updateSettings,
} from "../storage";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  grok: "Grok",
};

export function FloatingPanel() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<DiscussionStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const dragOffset = useRef({ x: 0, y: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ─── 初始化：从 storage 恢复状态 ───────────────────────
  useEffect(() => {
    loadData().then((data) => {
      setPosition(data.settings.panelPosition);
      setCollapsed(data.settings.panelCollapsed);
      if (data.currentDiscussion) {
        setStatus(data.currentDiscussion.status);
        setLogs(data.currentDiscussion.logs);
        setTopic(data.currentDiscussion.topic);
        setCurrentSpeaker(data.currentDiscussion.currentSpeaker);
      }
    });

    // 查询参与者
    chrome.runtime.sendMessage({ type: "popup:getParticipants" }, (response) => {
      if (response?.participants) {
        setParticipants(response.participants);
      }
    });
  }, []);

  // ─── 监听 Background 状态更新 ──────────────────────────
  useEffect(() => {
    function onUpdate(message: DiscussionUpdate) {
      if (message.type !== "discussion:update") return;
      setStatus(message.status);
      if (message.currentSpeaker !== undefined) {
        setCurrentSpeaker(message.currentSpeaker);
      }
      if (message.log) {
        setLogs((prev) => {
          const next = [...prev, message.log!];
          // 同步到 storage
          updateCurrentDiscussion({
            topic,
            status: message.status,
            round: message.round,
            currentSpeaker: message.currentSpeaker,
            logs: next,
            updatedAt: Date.now(),
          });
          return next;
        });
      }
    }
    const listener = (message: unknown) => onUpdate(message as DiscussionUpdate);
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [topic]);

  // ─── 日志自动滚动 ──────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ─── 拖拽 ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const newPos = {
        x: Math.max(0, e.clientX - dragOffset.current.x),
        y: Math.max(0, e.clientY - dragOffset.current.y),
      };
      setPosition(newPos);
    };
    const onUp = () => {
      setDragging(false);
      updateSettings({ panelPosition: position });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, position]);

  // ─── 操作 ──────────────────────────────────────────────
  const handleStart = () => {
    if (!topic.trim()) return;
    if (participants.length < 2) return;
    setStatus("running");
    setLogs([]);
    updateCurrentDiscussion({
      topic: topic.trim(),
      status: "running",
      round: 0,
      logs: [],
      updatedAt: Date.now(),
    });
    chrome.runtime.sendMessage({ type: "discussion:start", topic: topic.trim() });
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: "discussion:stop" });
    setStatus("stopped");
    updateCurrentDiscussion(null);
  };

  const isRunning = status === "running";

  // ─── 渲染 ──────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 99999,
        width: collapsed ? 200 : 360,
        maxHeight: collapsed ? "auto" : "80vh",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,.2)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 13,
        color: "#1a1a2e",
        overflow: "hidden",
        transition: dragging ? "none" : "width 0.2s, max-height 0.2s",
        userSelect: "none",
      }}
    >
      {/* 标题栏（可拖拽） */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(135deg, #6c63ff, #5a52d5)",
          color: "#fff",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>AI Round Table</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 10,
            background: "rgba(255,255,255,.2)",
          }}>
            {statusLabel(status)}
          </span>
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              updateSettings({ panelCollapsed: !collapsed });
            }}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {collapsed ? "▢" : "—"}
          </button>
        </div>
      </div>

      {/* 折叠时只显示标题栏 */}
      {collapsed ? null : (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: "calc(80vh - 50px)" }}>
          {/* 话题输入 */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 4 }}>
              讨论话题
            </label>
            <textarea
              data-no-drag
              placeholder="输入一个话题，让 AI 们展开辩论..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              disabled={isRunning}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #dee2e6",
                borderRadius: 8,
                fontSize: 13,
                resize: "none",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* 自动提交开关 */}
          <label
            data-no-drag
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: autoSubmit ? "#f0eeff" : "#f8f9fa",
              border: `1px solid ${autoSubmit ? "#6c63ff" : "#e9ecef"}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={autoSubmit}
              onChange={(e) => {
                const val = e.target.checked;
                setAutoSubmit(val);
                chrome.runtime.sendMessage({ type: "discussion:setAutoSubmit", autoSubmit: val });
              }}
              style={{ accentColor: "#6c63ff", width: 14, height: 14, cursor: "pointer" }}
            />
            <span style={{ fontWeight: 600, color: autoSubmit ? "#6c63ff" : "#495057" }}>
              {autoSubmit ? "自动提交" : "手动提交"}
            </span>
            <span style={{ color: "#6c757d", fontSize: 11, marginLeft: "auto" }}>
              {autoSubmit ? "AI 自动发送消息" : "需要你手动点发送"}
            </span>
          </label>

          {/* 操作按钮 */}
          <div style={{ display: "flex", gap: 8 }}>
            {!isRunning ? (
              <button
                data-no-drag
                onClick={handleStart}
                disabled={participants.length < 2}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: 8,
                  background: participants.length >= 2 ? "#6c63ff" : "#ccc",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: participants.length >= 2 ? "pointer" : "not-allowed",
                  fontSize: 13,
                }}
              >
                开始讨论
              </button>
            ) : (
              <button
                data-no-drag
                onClick={handleStop}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: 8,
                  background: "#dc3545",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                终止讨论
              </button>
            )}
          </div>

          {/* 参与者 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 6 }}>
              参与者 {participants.length > 0 && <span style={{ background: "#6c63ff", color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{participants.length}</span>}
            </div>
            {participants.length === 0 ? (
              <div style={{ color: "#6c757d", fontStyle: "italic", fontSize: 12 }}>
                打开 AI 标签页后自动出现
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {participants.map((p) => (
                  <div
                    key={p.tabId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 8px",
                      background: isRunning && currentSpeaker === p.platform ? "#f0eeff" : "#f8f9fa",
                      border: `1px solid ${isRunning && currentSpeaker === p.platform ? "#6c63ff" : "#e9ecef"}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isRunning && currentSpeaker === p.platform ? "#6c63ff" : "#28a745",
                      animation: isRunning && currentSpeaker === p.platform ? "rt-pulse 1.2s infinite" : "none",
                    }} />
                    <span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                    <span style={{ marginLeft: "auto", color: "#adb5bd", fontSize: 11 }}>#{p.tabId}</span>
                    {isRunning && currentSpeaker === p.platform && (
                      <span style={{ color: "#6c63ff", fontWeight: 600, fontSize: 11 }}>发言中</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 讨论日志 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 6 }}>讨论日志</div>
            <div style={{
              maxHeight: 180,
              overflowY: "auto",
              border: "1px solid #dee2e6",
              borderRadius: 8,
              background: "#fff",
            }}>
              {logs.length === 0 ? (
                <div style={{ padding: 10, color: "#6c757d", fontStyle: "italic", fontSize: 12 }}>暂无消息</div>
              ) : (
                <>
                  {logs.map((log, i) => (
                    <div key={i} style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      borderBottom: i < logs.length - 1 ? "1px solid #f1f3f5" : "none",
                      fontFamily: "'SF Mono', 'Cascadia Code', monospace",
                      color: log.startsWith("[错误]") ? "#dc3545" : log.startsWith("──") ? "#6c63ff" : "#1a1a2e",
                      fontWeight: log.startsWith("──") ? 600 : 400,
                      background: log.startsWith("──") ? "#f8f7ff" : "transparent",
                    }}>
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shadow DOM 内的 keyframes */}
      <style>{`
        @keyframes rt-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function statusLabel(status: DiscussionStatus): string {
  const labels: Record<DiscussionStatus, string> = {
    idle: "未开始",
    running: "进行中",
    paused: "已暂停",
    consensus: "已达成共识",
    stopped: "已终止",
  };
  return labels[status];
}
