import { useState, useEffect, useRef } from "react";
import type { DiscussionStatus, DiscussionUpdate, ParticipantInfo } from "../types";

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  grok: "Grok",
};

export function App() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<DiscussionStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | undefined>();
  const logEndRef = useRef<HTMLDivElement>(null);

  // 打开 Popup 时查询已注册的参与者
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "popup:getParticipants" }, (response) => {
      if (response?.participants) {
        setParticipants(response.participants);
      }
    });
  }, []);

  // 监听 Background 的状态更新
  useEffect(() => {
    function onUpdate(message: DiscussionUpdate) {
      if (message.type !== "discussion:update") return;
      setStatus(message.status);
      if (message.currentSpeaker !== undefined) {
        setCurrentSpeaker(message.currentSpeaker);
      }
      if (message.log) {
        setLogs((prev) => [...prev, message.log!]);
      }
    }

    const listener = (message: unknown) => {
      onUpdate(message as DiscussionUpdate);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // 日志自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = () => {
    if (!topic.trim()) return;
    if (participants.length < 2) {
      setLogs((prev) => [...prev, "[错误] 至少需要 2 个参与者才能开始讨论"]);
      return;
    }
    setStatus("running");
    setLogs([]);
    chrome.runtime.sendMessage({ type: "discussion:start", topic: topic.trim() });
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: "discussion:stop" });
    setStatus("stopped");
  };

  const isRunning = status === "running";

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">AI Round Table</h1>
        <span className={`status-badge status-${status}`}>
          {statusLabel(status)}
        </span>
      </header>

      <section className="topic-section">
        <label htmlFor="topic" className="label">
          讨论话题
        </label>
        <textarea
          id="topic"
          className="topic-input"
          placeholder="输入一个话题，让 AI 们展开辩论..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          disabled={isRunning}
        />
      </section>

      <section className="action-section">
        {!isRunning ? (
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={participants.length < 2}
            title={participants.length < 2 ? "至少需要 2 个参与者" : ""}
          >
            开始讨论
          </button>
        ) : (
          <button className="btn btn-danger" onClick={handleStop}>
            终止讨论
          </button>
        )}
      </section>

      <section className="participants-section">
        <h2 className="section-title">
          参与者
          {participants.length > 0 && (
            <span className="count-badge">{participants.length}</span>
          )}
        </h2>
        {participants.length === 0 ? (
          <p className="hint">打开 AI 标签页后，它们会自动出现在这里</p>
        ) : (
          <ul className="participant-list">
            {participants.map((p) => (
              <li
                key={p.tabId}
                className={`participant-item ${
                  isRunning && currentSpeaker === p.platform ? "speaking" : ""
                }`}
              >
                <span className={`participant-dot ${
                  isRunning && currentSpeaker === p.platform ? "pulse" : ""
                }`} />
                <span className="participant-name">
                  {PLATFORM_LABELS[p.platform] ?? p.platform}
                </span>
                <span className="participant-tab">Tab #{p.tabId}</span>
                {isRunning && currentSpeaker === p.platform && (
                  <span className="speaking-label">发言中</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="log-section">
        <h2 className="section-title">
          讨论日志
          {isRunning && <span className="round-badge">R{logs.length > 0 ? "" : ""}</span>}
        </h2>
        <div className="log-list">
          {logs.length === 0 ? (
            <p className="hint">暂无消息</p>
          ) : (
            <>
              {logs.map((log, i) => (
                <div key={i} className={`log-item ${logClass(log)}`}>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </section>
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

function logClass(log: string): string {
  if (log.startsWith("[错误]")) return "log-error";
  if (log.startsWith("──")) return "log-round";
  if (log.includes("等待回复")) return "log-waiting";
  return "";
}
