/**
 * 悬浮窗挂载器 — 使用 Shadow DOM 隔离样式。
 *
 * 在页面中创建一个 <div> + Shadow Root，然后在其中渲染 React 组件。
 * 这样悬浮窗的样式不会被宿主页面影响，也不会污染宿主页面。
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingPanel } from "./FloatingPanel";

let mounted = false;

/**
 * 挂载悬浮窗到当前页面。
 */
export function mountPanel(): void {
  if (mounted) return;
  mounted = true;

  // 创建宿主元素
  const host = document.createElement("div");
  host.id = "ai-round-table-root";
  document.body.appendChild(host);

  // 创建 Shadow Root 隔离样式
  const shadow = host.attachShadow({ mode: "closed" });

  // 创建 React 挂载点
  const container = document.createElement("div");
  container.style.all = "initial"; // 重置继承的宿主样式
  shadow.appendChild(container);

  // 渲染 React 组件
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <FloatingPanel />
    </React.StrictMode>,
  );
}
