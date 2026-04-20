function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

const REQUEST_ID_DATALIST_ID = "request-id-options";
const STRING_PREVIEW_LENGTH = 100;
const SUMMARY_POLL_INTERVAL_MS = 3000;
const RECENT_REQUEST_LIMIT = 10;

export function renderRecordPage(summary: {
  enabled: boolean;
  capturedCount: number;
  limit: number;
  sessionStartedAt?: number;
  recentKeys?: Array<{ key: string; requestId: string; path: string; createdAt: number }>;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>nanollm record</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f2efe7;
        --panel: rgba(255, 252, 247, 0.95);
        --border: #d8cfc1;
        --recording: #2cab63;
        --recording-soft: rgba(44, 171, 99, 0.2);
        --text: #2f271d;
        --muted: #736553;
        --accent: #8c5a2f;
        --accent-soft: rgba(140, 90, 47, 0.12);
        --shadow: 0 18px 46px rgba(58, 43, 24, 0.12);
        --danger: #be4a38;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top right, rgba(140, 90, 47, 0.12), transparent 24%),
          linear-gradient(180deg, #f7f4ec 0%, var(--bg) 100%);
      }
      .page {
        max-width: 1180px;
        margin: 0 auto;
        padding: 24px;
      }
      .panel {
        position: relative;
        isolation: isolate;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 20px;
        box-shadow: var(--shadow);
      }
      .panel::before {
        content: "";
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        padding: 2px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        background:
          repeating-linear-gradient(90deg, var(--recording) 0 8px, transparent 8px 14px) 0 0 / 100% 2px no-repeat,
          repeating-linear-gradient(180deg, var(--recording) 0 8px, transparent 8px 14px) 100% 0 / 2px 100% no-repeat,
          repeating-linear-gradient(270deg, var(--recording) 0 8px, transparent 8px 14px) 0 100% / 100% 2px no-repeat,
          repeating-linear-gradient(0deg, var(--recording) 0 8px, transparent 8px 14px) 0 0 / 2px 100% no-repeat;
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        mask-composite: exclude;
      }
      .panel.recording {
        border-color: transparent;
        box-shadow:
          var(--shadow),
          0 0 0 1px var(--recording-soft);
      }
      .panel.recording::before {
        opacity: 1;
        animation: record-border-crawl 1.25s linear infinite;
      }
      @keyframes record-border-crawl {
        to {
          background-position:
            14px 0,
            100% 14px,
            -14px 100%,
            0 -14px;
        }
      }
      h1, h2, h3 {
        margin: 0;
      }
      h1 {
        font-size: 30px;
      }
      h2 {
        font-size: 18px;
        margin-bottom: 12px;
      }
      h3 {
        font-size: 15px;
        margin-bottom: 10px;
      }
      .meta {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 14px;
      }
      .toolbar {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: end;
        margin-top: 18px;
      }
      label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        color: var(--muted);
      }
      input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        background: #fffdf9;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        background: var(--accent);
        color: #fffaf3;
      }
      button.secondary {
        background: transparent;
        color: var(--accent);
        border: 1px solid rgba(140, 90, 47, 0.28);
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .summary {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .pill {
        padding: 8px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }
      .danger {
        color: var(--danger);
      }
      .content {
        margin-top: 20px;
        display: grid;
        gap: 14px;
      }
      .recent {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .recent-key {
        appearance: none;
        border: 1px solid rgba(140, 90, 47, 0.18);
        background: #fffaf2;
        color: var(--accent);
        padding: 8px 10px;
        border-radius: 10px;
        font: inherit;
        cursor: pointer;
        text-align: left;
      }
      .recent-key small {
        display: block;
        color: var(--muted);
        font-size: 11px;
        margin-top: 3px;
      }
      .recent-more {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px dashed rgba(140, 90, 47, 0.24);
        color: var(--muted);
        background: rgba(255, 250, 242, 0.7);
        font-weight: 700;
      }
      .section {
        border: 1px solid rgba(216, 207, 193, 0.82);
        border-radius: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.58);
      }
      details.section {
        padding: 0;
        overflow: hidden;
      }
      details.section > summary,
      .fold > summary,
      .json-tree details > summary,
      .inline-fold > summary {
        cursor: pointer;
      }
      details.section > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px;
        list-style: none;
      }
      details.section > summary::-webkit-details-marker,
      .fold > summary::-webkit-details-marker,
      .inline-fold > summary::-webkit-details-marker {
        display: none;
      }
      details.section > summary::after {
        content: "展开";
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }
      details.section[open] > summary::after {
        content: "收起";
      }
      .section-body {
        padding: 0 16px 16px;
      }
      .section-title {
        font-size: 18px;
        font-weight: 700;
      }
      .kv {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 8px 12px;
        font-size: 14px;
      }
      .kv dt {
        color: var(--muted);
      }
      .kv dd {
        margin: 0;
        word-break: break-word;
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .attempt {
        border: 1px solid rgba(140, 90, 47, 0.16);
        border-radius: 14px;
        padding: 14px;
        background: rgba(255, 251, 245, 0.78);
      }
      .attempt-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 12px;
        margin-bottom: 8px;
      }
      .subgrid {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr;
      }
      .box {
        position: relative;
        border: 1px solid rgba(216, 207, 193, 0.82);
        border-radius: 12px;
        padding: 12px;
        background: #fffdfa;
        min-width: 0;
      }
      .copy-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 6px 10px;
        border-radius: 10px;
        font-size: 12px;
        line-height: 1;
      }
      .fold {
        border: 1px solid rgba(216, 207, 193, 0.82);
        border-radius: 12px;
        background: #fffdfa;
      }
      .fold + .fold {
        margin-top: 12px;
      }
      .fold > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        list-style: none;
        color: var(--accent);
        font-weight: 700;
      }
      .fold > summary::after {
        content: "展开";
        font-size: 12px;
      }
      .fold[open] > summary::after {
        content: "收起";
      }
      .fold-body {
        padding: 0 12px 12px;
      }
      .json-tree details {
        margin-left: 14px;
      }
      .json-tree summary {
        color: var(--accent);
      }
      .json-tree .entry {
        margin: 4px 0;
        line-height: 1.5;
        word-break: break-word;
      }
      .json-tree .key {
        color: #8a4f1d;
      }
      .json-tree .string {
        color: #0b6f51;
      }
      .json-tree .number {
        color: #2f5cb8;
      }
      .json-tree .boolean,
      .json-tree .null {
        color: #8c3d8c;
      }
      .inline-fold {
        display: inline-block;
        vertical-align: top;
        max-width: 100%;
      }
      .inline-fold > summary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        list-style: none;
      }
      .inline-fold > summary::after {
        content: "展开";
        color: var(--accent);
        font-size: 12px;
      }
      .inline-fold[open] > summary::after {
        content: "收起";
      }
      .inline-meta {
        color: var(--muted);
        font-size: 12px;
      }
      .stream-list {
        display: grid;
        gap: 10px;
      }
      .stream-meta {
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        line-height: 1.45;
      }
      .empty {
        color: var(--muted);
        font-style: italic;
      }
      @media (max-width: 840px) {
        .toolbar {
          grid-template-columns: 1fr;
        }
        .kv {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="panel${summary.enabled ? " recording" : ""}" id="record-panel">
        <h1>Request Record</h1>
        <p class="meta">输入完整 requestId 或前 6 位，页面会调用查询接口并展示本轮采样缓存里的请求详情。</p>
        <div class="toolbar">
          <div>
            <label for="request-id">requestId</label>
            <input id="request-id" name="requestId" list="${REQUEST_ID_DATALIST_ID}" placeholder="例如 6dfae2" />
            <datalist id="${REQUEST_ID_DATALIST_ID}"></datalist>
          </div>
          <div class="actions">
            <button id="query-button" type="button">查询</button>
            <button id="start-button" class="secondary" type="button">开始采样</button>
            <button id="stop-button" class="secondary" type="button">停止采样</button>
          </div>
        </div>
        <div class="summary" id="summary"></div>
        <div class="recent" id="recent"></div>
        <div class="content" id="content">
          <section class="section empty">还没有加载记录。</section>
        </div>
      </section>
    </main>
    <script>
      const INITIAL_SUMMARY = ${serializeForScript(summary)};
      const summaryEl = document.getElementById("summary");
      const recentEl = document.getElementById("recent");
      const contentEl = document.getElementById("content");
      const recordPanelEl = document.getElementById("record-panel");
      const requestIdInput = document.getElementById("request-id");
      const requestIdOptionsEl = document.getElementById("${REQUEST_ID_DATALIST_ID}");

      function normalizeRequestIdInput(value) {
        return value
          .trim()
          .replace(/^.*requestId=/i, "")
          .replace(/^[\\[\\("'\\s]+/, "")
          .replace(/[\\]\\)"'\\s,]+$/, "");
      }

      function setRequestIdOptions(summary) {
        requestIdOptionsEl.textContent = "";
        if (!summary.recentKeys || summary.recentKeys.length === 0) {
          return;
        }

        const seen = new Set();
        summary.recentKeys.forEach((item) => {
          if (seen.has(item.requestId)) return;
          seen.add(item.requestId);
          const option = document.createElement("option");
          option.value = item.requestId;
          option.label =
            item.key +
            " · " +
            item.path +
            " · " +
            new Date(item.createdAt).toLocaleTimeString("zh-CN");
          requestIdOptionsEl.appendChild(option);
        });
      }

      function setSummary(summary) {
        setRequestIdOptions(summary);
        recordPanelEl.classList.toggle("recording", summary.enabled === true);
        summaryEl.textContent = "";
        const items = [
          ["采样状态", summary.enabled ? "开启" : "关闭"],
          ["已采样", String(summary.capturedCount)],
          ["上限", String(summary.limit)],
          ["开始时间", summary.sessionStartedAt ? new Date(summary.sessionStartedAt).toLocaleString("zh-CN") : "-"],
        ];
        for (const [label, value] of items) {
          const pill = document.createElement("div");
          pill.className = "pill";
          pill.textContent = label + "：" + value;
          summaryEl.appendChild(pill);
        }

        recentEl.textContent = "";
        if (!summary.recentKeys || summary.recentKeys.length === 0) {
          return;
        }
        summary.recentKeys.slice(0, ${RECENT_REQUEST_LIMIT}).forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "recent-key";
          button.innerHTML =
            item.key +
            "<small>" +
            item.path +
            " · " +
            new Date(item.createdAt).toLocaleTimeString("zh-CN") +
            "</small>";
          button.addEventListener("click", () => {
            requestIdInput.value = item.requestId;
            queryRecord().catch((error) => renderError(error instanceof Error ? error.message : "查询失败"));
          });
          recentEl.appendChild(button);
        });
        if (summary.recentKeys.length > ${RECENT_REQUEST_LIMIT}) {
          const more = document.createElement("div");
          more.className = "recent-more";
          more.textContent = "...";
          recentEl.appendChild(more);
        }
      }

      function createSection(title) {
        const section = document.createElement("section");
        section.className = "section";
        const heading = document.createElement("h2");
        heading.textContent = title;
        section.appendChild(heading);
        return section;
      }

      function createCollapsibleSection(title, open = false) {
        const section = document.createElement("details");
        section.className = "section";
        section.open = open;

        const summary = document.createElement("summary");
        const heading = document.createElement("span");
        heading.className = "section-title";
        heading.textContent = title;
        summary.appendChild(heading);
        section.appendChild(summary);

        const body = document.createElement("div");
        body.className = "section-body";
        section.appendChild(body);

        return { section, body };
      }

      function createFold(title, open = false) {
        const fold = document.createElement("details");
        fold.className = "fold";
        fold.open = open;

        const summary = document.createElement("summary");
        summary.textContent = title;
        fold.appendChild(summary);

        const body = document.createElement("div");
        body.className = "fold-body";
        fold.appendChild(body);

        return { fold, body };
      }

      function appendKV(section, pairs) {
        const dl = document.createElement("dl");
        dl.className = "kv";
        for (const [key, value] of pairs) {
          const dt = document.createElement("dt");
          dt.textContent = key;
          const dd = document.createElement("dd");
          dd.textContent = value == null || value === "" ? "-" : String(value);
          dl.appendChild(dt);
          dl.appendChild(dd);
        }
        section.appendChild(dl);
      }

      function createStringNode(value) {
        const quoted = JSON.stringify(value);
        if (value.length <= ${STRING_PREVIEW_LENGTH}) {
          const span = document.createElement("span");
          span.className = "string";
          span.textContent = quoted;
          return span;
        }

        const details = document.createElement("details");
        details.className = "inline-fold";

        const summary = document.createElement("summary");
        const preview = document.createElement("span");
        preview.className = "string";
        preview.textContent = JSON.stringify(value.slice(0, ${STRING_PREVIEW_LENGTH}) + "…");
        const meta = document.createElement("span");
        meta.className = "inline-meta";
        meta.textContent = value.length + " chars";
        summary.appendChild(preview);
        summary.appendChild(meta);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "entry";
        const full = document.createElement("span");
        full.className = "string";
        full.textContent = quoted;
        body.appendChild(full);
        details.appendChild(body);

        return details;
      }

      function createValueNode(value, options) {
        const expanded = options?.expanded === true;
        if (value === null) {
          const span = document.createElement("span");
          span.className = "null";
          span.textContent = "null";
          return span;
        }

        if (Array.isArray(value)) {
          const details = document.createElement("details");
          details.open = expanded;
          const summary = document.createElement("summary");
          summary.textContent = "Array(" + value.length + ")";
          details.appendChild(summary);
          const body = document.createElement("div");
          value.forEach((item, index) => {
            const entry = document.createElement("div");
            entry.className = "entry";
            const key = document.createElement("span");
            key.className = "key";
            key.textContent = index + ": ";
            entry.appendChild(key);
            entry.appendChild(createValueNode(item, options));
            body.appendChild(entry);
          });
          details.appendChild(body);
          return details;
        }

        if (typeof value === "object") {
          const entries = Object.entries(value);
          const details = document.createElement("details");
          details.open = expanded;
          const summary = document.createElement("summary");
          summary.textContent = "Object{" + entries.length + "}";
          details.appendChild(summary);
          const body = document.createElement("div");
          for (const [keyName, childValue] of entries) {
            const entry = document.createElement("div");
            entry.className = "entry";
            const key = document.createElement("span");
            key.className = "key";
            key.textContent = keyName + ": ";
            entry.appendChild(key);
            entry.appendChild(createValueNode(childValue, options));
            body.appendChild(entry);
          }
          details.appendChild(body);
          return details;
        }

        const span = document.createElement("span");
        if (typeof value === "string") {
          return createStringNode(value);
        }
        if (typeof value === "number") {
          span.className = "number";
          span.textContent = String(value);
          return span;
        }
        if (typeof value === "boolean") {
          span.className = "boolean";
          span.textContent = String(value);
          return span;
        }
        span.textContent = String(value);
        return span;
      }

      function parseStreamEvents(text) {
        const normalized = text.replaceAll("\\r\\n", "\\n");
        if (!/(^|\\n)(data|event|id|retry):/.test(normalized)) {
          return null;
        }

        const blocks = normalized.split(/\\n\\n+/);
        const events = [];
        for (const block of blocks) {
          if (!block.trim()) continue;
          const lines = block.split("\\n");
          let eventName;
          let sawField = false;
          const dataLines = [];
          for (const line of lines) {
            if (!line) continue;
            if (line.startsWith(":")) {
              sawField = true;
              continue;
            }
            if (line.startsWith("event:")) {
              eventName = line.slice("event:".length).trimStart();
              sawField = true;
              continue;
            }
            if (line.startsWith("data:")) {
              dataLines.push(line.slice("data:".length).trimStart());
              sawField = true;
              continue;
            }
            if (line.startsWith("id:") || line.startsWith("retry:")) {
              sawField = true;
              continue;
            }
          }
          if (!sawField) {
            return null;
          }
          const data = dataLines.join("\\n");
          let parsed;
          if (data && data !== "[DONE]") {
            try {
              parsed = JSON.parse(data);
            } catch {}
          }
          events.push({ event: eventName, data, parsed });
        }
        return events;
      }

      function getStreamEventLabel(item, index) {
        if (item.event) return "#" + index + " " + item.event;
        if (item.data === "[DONE]") return "#" + index + " [DONE]";
        if (item.parsed && typeof item.parsed === "object" && typeof item.parsed.type === "string") {
          return "#" + index + " " + item.parsed.type;
        }
        return "#" + index + " data";
      }

      function reconstructStreamResponse(events) {
        return (
          reconstructOpenAIResponsesStream(events) ??
          reconstructOpenAIChatStream(events) ??
          reconstructAnthropicStream(events)
        );
      }

      function reconstructOpenAIResponsesStream(events) {
        let lastResponse = null;
        let sawResponsesEvent = false;
        for (const item of events) {
          const payload = item.parsed;
          if (!payload || typeof payload !== "object") continue;
          const type = item.event || payload.type;
          if (typeof type !== "string" || !type.startsWith("response.")) continue;
          sawResponsesEvent = true;
          if (payload.response && typeof payload.response === "object") {
            lastResponse = payload.response;
          }
          if (type === "response.completed" && payload.response) {
            return payload.response;
          }
        }
        return sawResponsesEvent ? lastResponse : null;
      }

      function reconstructOpenAIChatStream(events) {
        let state = null;
        const toolCallMap = new Map();
        let textContent = "";
        let refusalContent = "";
        let sawChatChunk = false;

        for (const item of events) {
          const payload = item.parsed;
          if (!payload || typeof payload !== "object" || payload.object !== "chat.completion.chunk") continue;
          sawChatChunk = true;
          if (!state) {
            state = {
              id: payload.id,
              created: payload.created,
              model: payload.model,
              finishReason: null,
              usage: null,
            };
          }
          if (payload.usage) {
            state.usage = payload.usage;
          }
          const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
          if (!choice) continue;
          if (choice.finish_reason != null) {
            state.finishReason = choice.finish_reason;
          }
          const delta = choice.delta ?? {};
          if (typeof delta.content === "string" && delta.content) {
            textContent += delta.content;
          }
          if (typeof delta.refusal === "string" && delta.refusal) {
            refusalContent += delta.refusal;
          }
          if (Array.isArray(delta.tool_calls)) {
            delta.tool_calls.forEach((toolCall) => {
              const index = Number.isFinite(toolCall.index) ? toolCall.index : 0;
              let entry = toolCallMap.get(index);
              if (!entry) {
                entry = {
                  id: toolCall.id || "call_" + index,
                  type: "function",
                  function: {
                    name: toolCall.function?.name || "",
                    arguments: "",
                  },
                };
                toolCallMap.set(index, entry);
              }
              if (toolCall.id) entry.id = toolCall.id;
              if (toolCall.function?.name) entry.function.name = toolCall.function.name;
              if (toolCall.function?.arguments) entry.function.arguments += toolCall.function.arguments;
            });
          }
        }

        if (!sawChatChunk || !state) return null;

        const message = {
          role: "assistant",
          content: null,
          refusal: refusalContent || null,
        };
        if (textContent && refusalContent) {
          message.content = [
            { type: "text", text: textContent },
            { type: "refusal", refusal: refusalContent },
          ];
        } else if (refusalContent) {
          message.content = [{ type: "refusal", refusal: refusalContent }];
        } else if (textContent) {
          message.content = textContent;
        }

        const toolCalls = [...toolCallMap.entries()]
          .sort((left, right) => left[0] - right[0])
          .map(([, value]) => value);
        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls;
        }

        return {
          id: state.id,
          object: "chat.completion",
          created: state.created,
          model: state.model,
          choices: [
            {
              index: 0,
              message,
              finish_reason: state.finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
              logprobs: null,
            },
          ],
          usage: state.usage,
        };
      }

      function reconstructAnthropicStream(events) {
        let response = null;
        let sawAnthropicEvent = false;
        const toolInputBuffers = new Map();

        function finalizeToolUse(index) {
          const block = response?.content?.[index];
          if (!block || block.type !== "tool_use") return;
          const partial = toolInputBuffers.get(index);
          if (!partial) {
            block.input = block.input && typeof block.input === "object" ? block.input : {};
            return;
          }
          try {
            block.input = JSON.parse(partial);
          } catch {
            block.input = { raw: partial };
          }
        }

        for (const item of events) {
          const payload = item.parsed;
          if (!payload || typeof payload !== "object" || typeof payload.type !== "string") continue;
          const type = payload.type;
          if (!["message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"].includes(type)) continue;
          sawAnthropicEvent = true;

          if (type === "message_start" && payload.message && typeof payload.message === "object") {
            response = JSON.parse(JSON.stringify(payload.message));
            if (!Array.isArray(response.content)) response.content = [];
            continue;
          }

          if (!response) continue;

          if (type === "content_block_start") {
            const index = payload.index;
            const block = payload.content_block ?? {};
            if (block.type === "text") {
              response.content[index] = { type: "text", text: block.text ?? "", citations: block.citations ?? null };
            } else if (block.type === "thinking") {
              response.content[index] = { type: "thinking", thinking: block.thinking ?? "", signature: block.signature ?? "" };
            } else if (block.type === "redacted_thinking") {
              response.content[index] = { type: "redacted_thinking", data: block.data ?? "" };
            } else if (block.type === "tool_use") {
              response.content[index] = {
                type: "tool_use",
                id: block.id,
                caller: block.caller ?? { type: "direct" },
                name: block.name,
                input: {},
              };
              toolInputBuffers.set(index, "");
            }
            continue;
          }

          if (type === "content_block_delta") {
            const index = payload.index;
            const block = response.content[index];
            const delta = payload.delta ?? {};
            if (!block || !delta.type) continue;
            if (delta.type === "text_delta") {
              block.text = (block.text ?? "") + (delta.text ?? "");
            } else if (delta.type === "thinking_delta") {
              block.thinking = (block.thinking ?? "") + (delta.thinking ?? "");
            } else if (delta.type === "signature_delta") {
              block.signature = (block.signature ?? "") + (delta.signature ?? "");
            } else if (delta.type === "input_json_delta") {
              toolInputBuffers.set(index, (toolInputBuffers.get(index) ?? "") + (delta.partial_json ?? ""));
            }
            continue;
          }

          if (type === "content_block_stop") {
            finalizeToolUse(payload.index);
            continue;
          }

          if (type === "message_delta") {
            response.stop_reason = payload.delta?.stop_reason ?? response.stop_reason ?? null;
            response.stop_sequence = payload.delta?.stop_sequence ?? response.stop_sequence ?? null;
            if (payload.usage) {
              response.usage = payload.usage;
            }
            continue;
          }

          if (type === "message_stop") {
            for (const index of toolInputBuffers.keys()) {
              finalizeToolUse(index);
            }
            return response;
          }
        }

        if (!sawAnthropicEvent || !response) return null;
        for (const index of toolInputBuffers.keys()) {
          finalizeToolUse(index);
        }
        return response;
      }

      function renderStreamValue(value) {
        const wrapper = document.createElement("div");
        wrapper.className = "json-tree";
        if (value && typeof value === "object") {
          wrapper.appendChild(createValueNode(value, { expanded: true }));
        } else if (typeof value === "string") {
          wrapper.appendChild(createStringNode(value));
        } else {
          wrapper.appendChild(createValueNode(value, { expanded: true }));
        }
        return wrapper;
      }

      function renderStreamBody(parent, value) {
        const events = parseStreamEvents(value);
        if (!events || events.length === 0) {
          parent.appendChild(renderStreamValue(value));
          return;
        }

        const reconstructed = reconstructStreamResponse(events);
        if (reconstructed) {
          const fold = createFold("完整响应");
          fold.body.appendChild(renderStreamValue(reconstructed));
          parent.appendChild(fold.fold);
        }

        const listFold = createFold("流事件");
        const list = document.createElement("div");
        list.className = "stream-list";
        events.forEach((item, index) => {
          const fold = createFold(getStreamEventLabel(item, index + 1));
          if (item.event) {
            const meta = document.createElement("div");
            meta.className = "stream-meta";
            meta.textContent = "event: " + item.event;
            fold.body.appendChild(meta);
          }
          fold.body.appendChild(renderStreamValue(item.parsed ?? item.data));
          list.appendChild(fold.fold);
        });
        listFold.body.appendChild(list);
        parent.appendChild(listFold.fold);
      }

     function appendBodyBox(parent, title, value, options) {
       const box = document.createElement("div");
       box.className = "box";
       const heading = document.createElement("h3");
       heading.textContent = title;
       box.appendChild(heading);
        if (value != null && value !== "") {
          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "copy-btn";
          copyBtn.textContent = "复制";
          copyBtn.addEventListener("click", () => {
            const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
            navigator.clipboard.writeText(text).then(() => {
              copyBtn.textContent = "已复制";
              setTimeout(() => { copyBtn.textContent = "复制"; }, 1500);
            }).catch(() => {
              copyBtn.textContent = "失败";
              setTimeout(() => { copyBtn.textContent = "复制"; }, 1500);
            });
          });
          box.appendChild(copyBtn);
        }
        if (value == null || value === "") {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "无内容";
         box.appendChild(empty);
       } else if (options?.streamText === true && typeof value === "string") {
          renderStreamBody(box, value);
        } else if (typeof value === "string") {
          const pre = document.createElement("pre");
          pre.textContent = value;
          box.appendChild(pre);
        } else {
          const tree = document.createElement("div");
          tree.className = "json-tree";
          tree.appendChild(createValueNode(value));
          box.appendChild(tree);
        }
        parent.appendChild(box);
      }

      function renderRecord(record) {
        contentEl.textContent = "";

        const baseSection = createSection("基本信息");
        appendKV(baseSection, [
          ["requestId", record.requestId],
          ["key", record.key],
          ["path", record.clientRequest?.path],
          ["stream", record.stream],
          ["createdAt", record.createdAt ? new Date(record.createdAt).toLocaleString("zh-CN") : "-"],
          ["error", record.error?.message ?? ""],
        ]);
        contentEl.appendChild(baseSection);

        const requestSection = createCollapsibleSection("Client Request");
        const requestGrid = document.createElement("div");
        requestGrid.className = "subgrid";
        appendBodyBox(requestGrid, "Headers", record.clientRequest?.headers);
        appendBodyBox(requestGrid, "Body", record.clientRequest?.body);
        requestSection.body.appendChild(requestGrid);
        contentEl.appendChild(requestSection.section);

        const attemptsSection = createSection("Attempts");
        const attemptsStack = document.createElement("div");
        attemptsStack.className = "stack";
        if (!record.attempts?.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "没有记录到上游请求。";
          attemptsStack.appendChild(empty);
        } else {
          record.attempts.forEach((attempt) => {
            const card = document.createElement("div");
            card.className = "attempt";
            const head = document.createElement("div");
            head.className = "attempt-head";
            const title = document.createElement("h3");
            title.textContent = "#" + attempt.index + " " + attempt.modelName + " (" + attempt.provider + ")";
            head.appendChild(title);
            card.appendChild(head);
            appendKV(card, [
              ["url", attempt.url],
              ["status", attempt.response?.status],
              ["error", attempt.error?.message ?? ""],
            ]);

            const upstreamRequestFold = createFold("Upstream Request");
            const upstreamRequestGrid = document.createElement("div");
            upstreamRequestGrid.className = "subgrid";
            appendBodyBox(upstreamRequestGrid, "Headers", attempt.request?.headers);
            appendBodyBox(upstreamRequestGrid, "Body", attempt.request?.body);
            upstreamRequestFold.body.appendChild(upstreamRequestGrid);
            card.appendChild(upstreamRequestFold.fold);

            const upstreamResponseFold = createFold("Upstream Response");
            const upstreamResponseGrid = document.createElement("div");
            upstreamResponseGrid.className = "subgrid";
            appendBodyBox(upstreamResponseGrid, "Headers", attempt.response?.headers);
            appendBodyBox(upstreamResponseGrid, "Body", attempt.response?.body, { streamText: record.stream });
            if (attempt.error?.upstream !== undefined) {
              appendBodyBox(upstreamResponseGrid, "Upstream Error Body", attempt.error.upstream);
            }
            upstreamResponseFold.body.appendChild(upstreamResponseGrid);
            card.appendChild(upstreamResponseFold.fold);

            attemptsStack.appendChild(card);
          });
        }
        attemptsSection.appendChild(attemptsStack);
        contentEl.appendChild(attemptsSection);

        const responseSection = createCollapsibleSection("Client Response");
        appendKV(responseSection.body, [
          ["status", record.clientResponse?.status],
          ["truncated", record.clientResponse?.truncated ? "yes" : "no"],
        ]);
        const responseGrid = document.createElement("div");
        responseGrid.className = "subgrid";
        appendBodyBox(responseGrid, "Headers", record.clientResponse?.headers);
        appendBodyBox(responseGrid, "Body", record.clientResponse?.body, { streamText: record.stream });
        responseSection.body.appendChild(responseGrid);
        contentEl.appendChild(responseSection.section);
      }

      function renderError(message) {
        contentEl.textContent = "";
        const section = document.createElement("section");
        section.className = "section";
        const text = document.createElement("div");
        text.className = "danger";
        text.textContent = message;
        section.appendChild(text);
        contentEl.appendChild(section);
      }

      async function refreshSummary() {
        const response = await fetch("/record/summary", { cache: "no-store" });
        if (!response.ok) return;
        setSummary(await response.json());
      }

      async function queryRecord() {
        const requestId = normalizeRequestIdInput(requestIdInput.value);
        if (!requestId) {
          renderError("请先输入 requestId。");
          return;
        }
        requestIdInput.value = requestId;
        const response = await fetch("/record/" + encodeURIComponent(requestId), { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          if (payload.summary) {
            setSummary(payload.summary);
          }
          renderError(payload.error || "查询失败");
          return;
        }
        if (payload.summary) {
          setSummary(payload.summary);
        }
        renderRecord(payload.record);
        history.replaceState(null, "", "/record?requestId=" + encodeURIComponent(requestId));
      }

      async function controlRecord(action) {
        const response = await fetch("/record/" + action, { method: "POST" });
        const payload = await response.json();
        setSummary(payload);
        if (action === "start") {
          contentEl.innerHTML = '<section class="section empty">新的采样会话已开始，等待请求进入。</section>';
        }
      }

      document.getElementById("query-button").addEventListener("click", () => {
        queryRecord().catch((error) => renderError(error instanceof Error ? error.message : "查询失败"));
      });
      document.getElementById("start-button").addEventListener("click", () => {
        controlRecord("start").catch((error) => renderError(error instanceof Error ? error.message : "开始采样失败"));
      });
      document.getElementById("stop-button").addEventListener("click", () => {
        controlRecord("stop").catch((error) => renderError(error instanceof Error ? error.message : "停止采样失败"));
      });

      setSummary(INITIAL_SUMMARY);
      setInterval(() => {
        refreshSummary().catch(() => {});
      }, ${SUMMARY_POLL_INTERVAL_MS});

      const params = new URLSearchParams(window.location.search);
      const preset = params.get("requestId");
      if (preset) {
        requestIdInput.value = preset;
        queryRecord().catch((error) => renderError(error instanceof Error ? error.message : "查询失败"));
      }
    </script>
  </body>
</html>`;
}
