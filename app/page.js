"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onValue, ref, set, push, serverTimestamp } from "firebase/database";
import { auth, db } from "../lib/firebase";
import {
  Sparkles, Plus, MessageSquare, Search, Code2, Image, Paperclip,
  Send, Settings, History, Menu, X, GitCompare, Copy, Download, Eye, LogOut
} from "lucide-react";

const MODEL_CATEGORIES = [
  { id: "reasoning", label: "Reasoning", match: /reason|thinking|r1|o1|o3/i },
  { id: "coding", label: "Coding", match: /code|coder|codestral|starcoder/i },
  { id: "creative", label: "Creative", match: /creative|llama|qwen|claude|gemma|mistral/i },
  { id: "fast", label: "Fast", match: /mini|small|flash|haiku|lite|nano|fast/i }
];

function getModelCategory(model) {
  const id = String(model?.id || model || "");
  const found = MODEL_CATEGORIES.find((category) => category.match.test(id));
  return found?.id || "general";
}

const modes = [
  { id: "chat", label: "Chat", icon: MessageSquare, hint: "Ask anything" },
  { id: "research", label: "Research", icon: Search, hint: "Analyze a topic" },
  { id: "code", label: "Code", icon: Code2, hint: "Build and debug" },
  { id: "create", label: "Create", icon: Image, hint: "Create ideas" },
  { id: "image", label: "Image", icon: Image, hint: "Generate images" },
  { id: "compare", label: "Compare", icon: GitCompare, hint: "Run up to 5 AIs together" }
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [history, setHistory] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("Checking…");
  const [textModels, setTextModels] = useState([]);
  const [imageModels, setImageModels] = useState([]);
  const [textModel, setTextModel] = useState("openai");
  const [imageModel, setImageModel] = useState("flux");
  const [compareModels, setCompareModels] = useState([]);
  const [compareCategory, setCompareCategory] = useState("all");
  const [compareResults, setCompareResults] = useState([]);
  const [imageCompare, setImageCompare] = useState(false);
  const [imageCompareModels, setImageCompareModels] = useState([]);
  const [imageCompareResults, setImageCompareResults] = useState([]);
  const [imageViewer, setImageViewer] = useState(null);
  const [codePreview, setCodePreview] = useState(null);
  const [chatMotion, setChatMotion] = useState("smooth");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [chatId, setChatId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        window.location.href = "/auth";
        return;
      }
      const chatsRef = ref(db, "users/" + nextUser.uid + "/chats");
      onValue(chatsRef, (snapshot) => {
        const value = snapshot.val() || {};
        const remoteHistory = Object.entries(value)
          .map(([id, chat]) => ({ ...chat, id }))
          .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
          .slice(0, 30);
        if (remoteHistory.length) setHistory(remoteHistory);
      });
    });
    try {
      const saved = JSON.parse(localStorage.getItem("flash-ai-history") || "[]");
      if (Array.isArray(saved)) setHistory((current) => current.length ? current : saved);
      const savedMotion = localStorage.getItem("flash-ai-chat-motion");
      if (savedMotion) setChatMotion(savedMotion);
    } catch {}
    Promise.all([fetch("/api/chat"), fetch("/api/pollinations/models"), fetch("/api/pollinations/image-models")]).then(async ([chatRes, textRes, imageRes]) => {
      const data = await chatRes.json();
      const textData = await textRes.json();
      const imageData = await imageRes.json();
      const tm = Array.isArray(textData?.data) ? textData.data : Array.isArray(textData) ? textData : [];
      const im = Array.isArray(imageData?.data) ? imageData.data : Array.isArray(imageData) ? imageData : [];
      setTextModels(tm);
      setImageModels(im);
      const liveImageIds = im.map((m) => m?.id || m).filter(Boolean);
      setImageCompareModels(liveImageIds.slice(0, 3));
      if (tm.some((m) => (m?.id || m) === "openai")) setTextModel("openai");
      else if (tm[0]) setTextModel(tm[0]?.id || tm[0]);
      if (im.some((m) => (m?.id || m) === "flux")) setImageModel("flux");
      else if (im[0]) setImageModel(im[0]?.id || im[0]);
      setCompareModels(
        tm.map((m) => m?.id || m)
          .filter((id) => id && !/^typesafe\//i.test(id))
          .slice(0, 5)
      );
      setServiceStatus(data?.configured ? `Connected · ${data.model}` : "API key not configured");
    }).catch(() => setServiceStatus("Unavailable"));
  }, []);

  useEffect(() => {
    if (!messages.length || loading || !user || !authReady) return;
    const timer = setTimeout(async () => {
      const first = messages.find((m) => m.role === "user")?.content || "New conversation";
      const id = chatId || push(ref(db, "users/" + user.uid + "/chats")).key;
      if (!id) return;
      if (!chatId) setChatId(id);
      const chat = {
        title: first.slice(0, 52),
        messages,
        mode,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp()
      };
      try {
        await set(ref(db, "users/" + user.uid + "/chats/" + id), chat);
        setHistory((current) => {
          const item = { ...chat, id };
          const without = current.filter((entry) => entry.id !== id);
          return [item, ...without].slice(0, 30);
        });
      } catch {}
      try { localStorage.setItem("flash-ai-history", JSON.stringify([chat, ...history.filter((entry) => entry.id !== id)].slice(0, 20))); } catch {}
    }, 700);
    return () => clearTimeout(timer);
  }, [messages, loading, mode, user, authReady, chatId]);

  const loadConversation = (item) => {
    setMessages(item.messages || []);
    setMode(item.mode || "chat");
    setChatId(item.id || null);
    setMobileOpen(false);
  };

  const startMode = (nextMode) => {
    setChatId(null);
    setMode(nextMode);
    setMobileOpen(false);
    const prompts = {
      research: "Research and explain this topic with key facts and sources: ",
      code: "Help me build or debug this code: ",
      create: "Help me create something for this idea: "
    };
    if (nextMode === "compare" || nextMode === "image") {
      setInput("");
      if (nextMode !== "image") setImageCompare(false);
    }
    else if (nextMode !== "chat") setInput(prompts[nextMode] || "");
  };

  const openImageViewer = (url, model = "Flash-AI-image") => {
    if (url) setImageViewer({ url, model });
  };

  const downloadImage = async (url, model = "Flash-AI-image") => {
    if (!url) return;
    const safeName = String(model).replace(/[^a-z0-9._-]+/gi, "-").slice(0, 70) || "flash-ai-image";
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${safeName}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = `${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const send = async () => {
    const text = String(input || "").trim();
    if (!text || loading) return;

    if (mode === "compare") {
      if (!compareModels.length) {
        setMessages((current) => [...current, { role: "assistant", content: "Select at least one model for comparison." }]);
        return;
      }
      setInput("");
      setCompareResults(compareModels.map((model) => ({ model, ok: true, content: "", loading: true })));
      try {
        const response = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, { role: "user", content: text }], models: compareModels })
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "Comparison failed.");
        }
        if (!response.body) throw new Error("Comparison stream is unavailable.");

        setMessages((current) => [...current, { role: "user", content: text }]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const applyEvent = (eventText) => {
          const line = eventText.split("\n").find((entry) => entry.startsWith("data:"));
          if (!line) return;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "result" && event.result) {
              setCompareResults((current) =>
                current.map((item) => item.model === event.result.model
                  ? { ...item, ...event.result, loading: false }
                  : item)
              );
            } else if (event.type === "error") {
              setCompareResults((current) =>
                current.map((item) => item.loading
                  ? { ...item, ok: false, loading: false, content: event.message || "Comparison failed." }
                  : item)
              );
            }
          } catch {
            // Ignore an incomplete/malformed SSE event so completed model results stay visible.
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const eventText of events) applyEvent(eventText);
          if (done) break;
        }
        if (buffer.trim()) applyEvent(buffer);
      } catch (error) {
        setCompareResults((current) =>
          current.map((item) => item.loading
            ? { ...item, ok: false, loading: false, content: error?.message || "Comparison stream failed." }
            : item)
        );
      }
      return;
    }

    if (mode === "image") {
      setInput("");
      setLoading(true);

      const selectedImageModels = (imageCompare ? imageCompareModels : [imageModel]).slice(0, 3);
      if (!selectedImageModels.length) {
        setMessages((current) => [...current, { role: "assistant", content: "Select at least one image model." }]);
        setLoading(false);
        return;
      }

      if (imageCompare) {
        setImageCompareResults(selectedImageModels.map((model) => ({ model, loading: true })));
        setMessages((current) => [...current, { role: "user", content: text }]);

        try {
          const results = await Promise.all(selectedImageModels.map(async (model) => {
            try {
              const response = await fetch("/api/pollinations/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: text, model })
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data?.error || `Image request failed (${response.status})`);
              return {
                model,
                ok: true,
                imageUrl: data?.image?.url ||
                  data?.image?.dataUrl ||
                  (data?.image?.b64_json ? `data:${data?.image?.mimeType || "image/png"};base64,${data.image.b64_json}` : "")
              };
            } catch (error) {
              return { model, ok: false, error: error?.message || "Image generation failed." };
            }
          }));
          setImageCompareResults(results);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/pollinations/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, model: imageModel })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Image request failed (${response.status})`);
        setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: `Generated with ${data.model || imageModel}`, imageUrl: data?.image?.url || data?.image?.dataUrl || (data?.image?.b64_json ? `data:${data?.image?.mimeType || "image/png"};base64,${data.image.b64_json}` : "") }]);
      } catch (error) {
        setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: error?.message || "Image generation failed." }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setInput("");
    const next = [...messages, { role: "user", content: text, mode }];
    setMessages(next);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, mode, model: textModel })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (!response.body) throw new Error("No response stream was returned.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      setMessages((current) => [...current, { role: "assistant", content: "", mode }]);

      const consume = (chunk) => {
        buffer += chunk;
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const token = json?.choices?.[0]?.delta?.content || "";
              if (token) {
                answer += token;
                setMessages((current) => {
                  const copy = [...current];
                  copy[copy.length - 1] = { role: "assistant", content: answer, mode };
                  return copy;
                });
              }
            } catch {
              // Ignore incomplete SSE payloads; the next chunk completes them.
            }
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      consume(decoder.decode());

      if (!answer) {
        setMessages((current) => {
          const copy = [...current];
          copy[copy.length - 1] = { role: "assistant", content: "No response was returned." };
          return copy;
        });
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: error?.message || "I couldn't connect to the AI service." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const downloadCode = (code, language = "txt") => {
    const ext = ({ js: "js", jsx: "jsx", ts: "ts", tsx: "tsx", html: "html", css: "css", json: "json", py: "py", python: "py", java: "java", cpp: "cpp", c: "c", sql: "sql", sh: "sh", bash: "sh" })[language.toLowerCase()] || "txt";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flash-ai-code." + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highlightCode = (code, language) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let html = escaped;
    html = html.replace(/(\/\/.*$|\/\*[\\s\\S]*?\*\/|<!--.*?-->)/gm, '<span class="tok-comment">$1</span>');
    html = html.replace(/(&quot;.*?&quot;|&quot;.*?&quot;|".*?"|\'.*?\')/g, '<span class="tok-string">$1</span>');
    html = html.replace(/\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|async|await|true|false|null|undefined|def|in|print)\b/g, '<span class="tok-keyword">$1</span>');
    html = html.replace(/(&lt;\/?[a-zA-Z][\w-]*)(?=[\s&gt;])/g, '<span class="tok-tag">$1</span>');
    html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
    html = html.replace(/\b([a-zA-Z_$][\w$]*)(?=\()/g, '<span class="tok-function">$1</span>');
    return { __html: html };
  };

  const renderCodeContent = (content, messageIndex) => {
    const parts = content.split(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g);
    if (parts.length === 1) return <div className="plainResponse">{content}</div>;
    const blocks = [];
    for (let i = 0; i < parts.length; i += 3) {
      if (parts[i]?.trim()) blocks.push(<div key={"text-" + i} className="codeText">{parts[i]}</div>);
      const language = parts[i + 1] || "code";
      const code = parts[i + 2] || "";
      const isHtml = /^(html|htm)$/i.test(language);
      const previewKey = messageIndex + "-" + i;
      blocks.push(
        <section key={previewKey} className="codeBlock">
          <div className="codeBlockHead">
            <span><Code2 size={13} /> {language.toUpperCase()}</span>
            <div>
              {isHtml && <button type="button" onClick={() => setCodePreview(codePreview === previewKey ? null : previewKey)}><Eye size={13} /> {codePreview === previewKey ? "Code" : "Preview"}</button>}
              <button type="button" onClick={() => copyMessage(code.trim(), "code-" + previewKey)}><Copy size={13} /> {copied === "code-" + previewKey ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => downloadCode(code.trim(), language)}><Download size={13} /> Save</button>
            </div>
          </div>
          {codePreview === previewKey && isHtml ? <iframe className="codePreview" title="Live HTML preview" sandbox="allow-scripts" srcDoc={code.trim()} /> : <pre><code dangerouslySetInnerHTML={highlightCode(code.trim(), language)} /></pre>}
        </section>
      );
    }
    return <div className="codeResponse">{blocks}</div>;
  };
  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(index);
      setTimeout(() => setCopied(null), 1400);
    } catch {}
  };

  const active = modes.find((item) => item.id === mode) || modes[0];

  return (
    <>
      {imageViewer?.url && (
      <div className="imageViewerBackdrop" onClick={() => setImageViewer(null)}>
        <div className="imageViewer" onClick={(event) => event.stopPropagation()}>
          <div className="imageViewerHead">
            <span>{imageViewer.model}</span>
            <button type="button" className="imageViewerClose" onClick={() => setImageViewer(null)} aria-label="Close image viewer">×</button>
          </div>
          <div className="imageViewerBody">
            <img src={imageViewer.url} alt="Full screen generated by Flash AI" />
          </div>
          <div className="imageViewerActions">
            <button type="button" onClick={() => downloadImage(imageViewer.url, imageViewer.model)}>↓ Download image</button>
            <button type="button" onClick={() => setImageViewer(null)}>Close</button>
          </div>
        </div>
      </div>
    )}

    <main className={`shell motion-${chatMotion}`}>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="logo"><Sparkles size={20} /></div>
          <div><b>Flash AI</b><small>Professional AI</small></div>
          <button className="closeMobile" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <button className="new" onClick={() => { setMessages([]); setMode("chat"); setInput(""); setMobileOpen(false); }}>
          <Plus size={18} /> New chat
        </button>

        <nav>
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={mode === item.id ? "active" : ""}
                onClick={() => startMode(item.id)}
              >
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="history">
          <span><History size={15} /> Recent</span>
          {history.length ? history.slice(0, 8).map((item) => (
            <button key={item.id} className="historyItem" onClick={() => loadConversation(item)}>
              <MessageSquare size={14} />
              <span>{item.title}</span>
            </button>
          )) : <p>No conversations yet</p>}
        </div>
        <button className="settings" onClick={() => setSettingsOpen(true)}><Settings size={17} /> Settings</button>
      </aside>

      <section className="main">
        <header>
          <button className="mobile" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div><span className="status" /> Flash AI <small>Online</small></div>
          <button className="icon" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
        </header>

        <div className="content">
          {messages.length === 0 ? (
            <div className="hero">
              <div className="heroicon"><Sparkles size={30} /></div>
              <p className="eyebrow">Professional AI workspace</p>
              <h1>What can I help you <em>create?</em></h1>
              <p>Chat, research, code and create from one fast, focused AI workspace.</p>

              <div className="cards">
                {modes.slice(1).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} onClick={() => startMode(item.id)}>
                      <Icon />
                      <b>{item.label}</b>
                      <small>{item.hint}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <div key={index} className={`msg ${message.role}`}>
                  <div className="bubble">
                    <div className={message.mode === "code" ? "messageContent codeMessage" : "messageContent"}>{message.mode === "code" ? renderCodeContent(message.content, index) : <div className="plainResponse">{message.content}</div>}</div>{message.imageUrl && (
  <div className="generatedImageWrap">
    <img className="generatedImage" src={message.imageUrl} alt="Generated by Flash AI" onClick={() => openImageViewer(message.imageUrl, "Flash-AI")} />
    <div className="imageActions">
      <button type="button" onClick={() => openImageViewer(message.imageUrl, "Flash-AI")}>⛶ Full screen</button>
      <button type="button" onClick={() => downloadImage(message.imageUrl, "Flash-AI")}>↓ Download</button>
    </div>
  </div>
)}
                    {message.role === "assistant" && message.content && (
                      <button className="copy" onClick={() => copyMessage(message.content, index)}>
                        {copied === index ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="msg assistant"><div className="typing">Generating<span>.</span><span>.</span><span>.</span></div></div>}
              {mode === "image" && imageCompare && imageCompareResults.length > 0 && (
                <div className="imageCompareGrid">
                  {imageCompareResults.map((result) => (
                    <article className={`imageCompareCard ${result.ok === false ? "compareError" : ""}`} key={result.model}>
                      <div className="imageCompareHead">
                        <b>{result.model}</b>
                        <span className={result.loading ? "compareDot running" : result.ok === false ? "compareDot imageCompareErrorDot" : "compareDot"} />
                      </div>
                      {result.loading ? (
                        <div className="imageCompareLoading">Generating<span>.</span><span>.</span><span>.</span></div>
                      ) : result.imageUrl ? (
                        <div className="compareImageWrap">
  <img className="compareImage" src={result.imageUrl} alt={`Generated with ${result.model}`} onClick={() => openImageViewer(result.imageUrl, result.model)} />
  <div className="imageActions">
    <button type="button" onClick={() => openImageViewer(result.imageUrl, result.model)}>⛶ Full screen</button>
    <button type="button" onClick={() => downloadImage(result.imageUrl, result.model)}>↓ Download</button>
  </div>
</div>
                      ) : (
                        <div className="imageCompareError">{result.error || "Image generation failed."}</div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {mode === "compare" && compareResults.length > 0 && (
                <div className="compareGrid">
                  {compareResults.map((result) => (
                    <article className={`compareCard ${result.ok === false ? "compareError" : ""}`} key={result.model}>
                      <div className="compareHead"><div><b>{result.model}</b><small>{MODEL_CATEGORIES.find((item) => item.id === getModelCategory(result.model))?.label || "General"} · {result.loading ? "Working…" : result.ok === false ? "Error" : `${((result.ms || 0) / 1000).toFixed(1)}s · Done`}</small></div><span className={result.loading ? "compareDot running" : result.ok === false ? "compareDot error" : "compareDot"} /></div>
                      <div className="compareBody">{result.loading ? <div className="typing">Thinking<span>.</span><span>.</span><span>.</span></div> : result.content}</div>
                      {!result.loading && result.content && <button className="copy" onClick={() => copyMessage(result.content, `compare-${result.model}`)}>{copied === `compare-${result.model}` ? "Copied" : "Copy"}</button>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="composer">
          <div className="modebar">
            <span>{active.label}</span>
            <small>{active.hint}</small>
            {mode === "compare" ? (
              <button className="compareConfig" onClick={() => setSettingsOpen(true)}>
                {compareModels.length}/5 models selected · Configure
              </button>
            ) : mode === "image" ? (
              <>
                {!imageCompare && (
                  <label className="imageModelControl">
                    <span>Model</span>
                    <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} aria-label="Choose image generation model">
                      {imageModels.length ? imageModels.map((m) => {
                        const id = m?.id || m;
                        return <option key={id} value={id}>{m?.name || id}</option>;
                      }) : <option value="flux">flux</option>}
                    </select>
                  </label>
                )}
                <button className={`imageCompareToggle ${imageCompare ? "active" : ""}`} onClick={() => setImageCompare((value) => !value)}>
                  {imageCompare ? `3 images · Configure` : "Compare 3 images"}
                </button>
              </>
            ) : (
              <select value={textModel} onChange={(e) => setTextModel(e.target.value)} aria-label="Text model">
                {textModels.map((m) => {
                  const id = m?.id || m;
                  return <option key={id} value={id}>{m?.name || id}</option>;
                })}
              </select>
            )}
          </div>
          <div className="input">
            <button title="Attach"><Paperclip size={19} /></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Ask Flash AI in ${active.label.toLowerCase()} mode...`}
            />
            <button className="send" onClick={send} disabled={loading || !String(input || "").trim()}><Send size={18} /></button>
          </div>
          <small>Flash AI can make mistakes. Verify important information.</small>
        </div>
        {settingsOpen && (
          <div className="modalBackdrop" onClick={() => setSettingsOpen(false)}>
            <div className="settingsModal" onClick={(e) => e.stopPropagation()}>
              <div className="modalHead">
                <div><b>Flash AI Settings</b><small>Provider and workspace controls</small></div>
                <button className="icon" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
              </div>
              <div className="modelPickerSection motionSettings">
                <div className="modelPickerTitle"><span>Chat animation & transition</span><b>{chatMotion === "none" ? "Off" : chatMotion}</b></div>
                <select className="motionSelect" value={chatMotion} onChange={(e) => { const value = e.target.value; setChatMotion(value); localStorage.setItem("flash-ai-chat-motion", value); }}>
                  <option value="smooth">Smooth — fade + slide</option>
                  <option value="slide">Slide — fast entrance</option>
                  <option value="glow">Glow — premium emphasis</option>
                  <option value="minimal">Minimal — subtle</option>
                  <option value="none">Off — no animation</option>
                </select>
                <small className="modalNote">Choose how new chat messages and AI responses enter the screen.</small>
              </div>
              <label>Text model<select value={textModel} onChange={(e) => setTextModel(e.target.value)}>
                {textModels.map((m) => { const id = m?.id || m; return <option key={id} value={id}>{m?.name || id}</option>; })}
              </select></label>
              <label>Image model<select value={imageModel} onChange={(e) => setImageModel(e.target.value)}>
                {imageModels.map((m) => { const id = m?.id || m; return <option key={id} value={id}>{m?.name || id}</option>; })}
              </select></label>
              <div className="modelPickerSection">
                <div className="modelPickerTitle">
                  <span>Compare models</span>
                  <div className="modelPickerCount">
                    <b>{compareModels.length}/5</b>
                    {compareModels.length > 0 && (
                      <button type="button" className="modelClear" onClick={() => setCompareModels([])}>Clear</button>
                    )}
                  </div>
                </div>
                {compareModels.length > 0 && (
                  <div className="selectedModelChips" aria-label="Selected comparison models">
                    {compareModels.map((id) => (
                      <button
                        type="button"
                        key={id}
                        className="selectedModelChip"
                        onClick={() => setCompareModels((current) => current.filter((item) => item !== id))}
                        title="Remove model"
                      >
                        {id}<span>×</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="modelCategoryTabs">
                  <button type="button" className={compareCategory === "all" ? "active" : ""} onClick={() => setCompareCategory("all")}>All</button>
                  {MODEL_CATEGORIES.map((category) => (
                    <button key={category.id} type="button" className={compareCategory === category.id ? "active" : ""} onClick={() => setCompareCategory(category.id)}>{category.label}</button>
                  ))}
                </div>
                <div className="modelPicker">
                  {textModels
                    .filter((m) => !/^typesafe\//i.test(m?.id || m))
                    .filter((m) => compareCategory === "all" || getModelCategory(m) === compareCategory)
                    .map((m) => {
                      const id = m?.id || m;
                      const label = m?.name || id;
                      const category = MODEL_CATEGORIES.find((item) => item.id === getModelCategory(m))?.label || "General";
                      const selected = compareModels.includes(id);
                      return (
                        <button type="button" key={id} className={`modelOption ${selected ? "selected" : ""}`} onClick={() => {
                          setCompareModels((current) => {
                            if (current.includes(id)) return current.filter((item) => item !== id);
                            if (current.length >= 5) return current;
                            return [...current, id];
                          });
                        }}>
                          <span className="modelCheck">{selected ? "✓" : ""}</span>
                          <span className="modelInfo"><b>{label}</b><small>{id} · {category}</small></span>
                          {selected && <span className="modelSelected">Selected</span>}
                        </button>
                      );
                    })}
                </div>
                <small className="modalNote">Choose up to 5 models from any categories. The same task is sent to every selected model simultaneously.</small>
              </div>
              <div className="modelPickerSection">
                <div className="modelPickerTitle">
                  <span>Image comparison</span>
                  <b>{imageCompareModels.length}/3</b>
                </div>
                <div className="modelPicker">
                  {imageModels.map((m) => {
                    const id = m?.id || m;
                    const label = m?.name || id;
                    const selected = imageCompareModels.includes(id);
                    return (
                      <button
                        type="button"
                        key={`image-${id}`}
                        className={`modelOption ${selected ? "selected" : ""}`}
                        onClick={() => {
                          setImageCompareModels((current) => {
                            if (current.includes(id)) {
                              const next = current.filter((item) => item !== id);
                              return next;
                            }
                            if (current.length >= 3) return current;
                            return [...current, id];
                          });
                        }}
                      >
                        <span className="modelCheck">{selected ? "✓" : ""}</span>
                        <span className="modelInfo"><b>{label}</b><small>{id}</small></span>
                        {selected && <span className="modelSelected">Selected</span>}
                      </button>
                    );
                  })}
                </div>
                <small className="modalNote">Choose up to 3 image models. Flash AI generates them in parallel for the same prompt.</small>
              </div>
              <div className="service"><span className="status" /> {serviceStatus}</div>
            </div>
          </div>
        )}
      </section>
    </main>
    </>
  );
}
