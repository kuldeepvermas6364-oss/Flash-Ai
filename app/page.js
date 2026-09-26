"use client";

import { useEffect, useState } from "react";
import {
  Sparkles, Plus, MessageSquare, Search, Code2, Image, Paperclip,
  Send, Settings, History, Menu, X
} from "lucide-react";

const modes = [
  { id: "chat", label: "Chat", icon: MessageSquare, hint: "Ask anything" },
  { id: "research", label: "Research", icon: Search, hint: "Analyze a topic" },
  { id: "code", label: "Code", icon: Code2, hint: "Build and debug" },
  { id: "create", label: "Create", icon: Image, hint: "Create ideas" },
  { id: "image", label: "Image", icon: Image, hint: "Generate images" }
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("flash-ai-history") || "[]");
      if (Array.isArray(saved)) setHistory(saved);
    } catch {}
    Promise.all([fetch("/api/chat"), fetch("/api/pollinations/models"), fetch("/api/pollinations/image-models")]).then(async ([chatRes, textRes, imageRes]) => {
      const data = await chatRes.json();
      const textData = await textRes.json();
      const imageData = await imageRes.json();
      const tm = Array.isArray(textData?.data) ? textData.data : Array.isArray(textData) ? textData : [];
      const im = Array.isArray(imageData?.data) ? imageData.data : Array.isArray(imageData) ? imageData : [];
      setTextModels(tm);
      setImageModels(im);
      if (tm.some((m) => (m?.id || m) === "openai")) setTextModel("openai");
      else if (tm[0]) setTextModel(tm[0]?.id || tm[0]);
      if (im.some((m) => (m?.id || m) === "flux")) setImageModel("flux");
      else if (im[0]) setImageModel(im[0]?.id || im[0]);
      setServiceStatus(data?.configured ? `Connected · ${data.model}` : "API key not configured");
      setServiceStatus(data?.configured ? `Connected · ${data.model}` : "API key not configured");
    }).catch(() => setServiceStatus("Unavailable"));
  }, []);

  useEffect(() => {
    if (!messages.length || loading) return;
    const timer = setTimeout(() => {
      const first = messages.find((m) => m.role === "user")?.content || "New conversation";
      const item = { id: Date.now(), title: first.slice(0, 52), messages, mode, updatedAt: new Date().toISOString() };
      setHistory((current) => {
        const next = [item, ...current].slice(0, 20);
        localStorage.setItem("flash-ai-history", JSON.stringify(next));
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, loading, mode]);

  const loadConversation = (item) => {
    setMessages(item.messages || []);
    setMode(item.mode || "chat");
    setMobileOpen(false);
  };

  const startMode = (nextMode) => {
    setMode(nextMode);
    setMobileOpen(false);
    const prompts = {
      research: "Research and explain this topic with key facts and sources: ",
      code: "Help me build or debug this code: ",
      create: "Help me create something for this idea: "
    };
    if (nextMode !== "chat") setInput(prompts[nextMode]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (mode === "image") {
      setInput("");
      setLoading(true);
      try {
        const response = await fetch("/api/pollinations/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, model: imageModel }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Image request failed (${response.status})`);
        setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: `Generated with ${data.model || imageModel}`, imageUrl: data?.image?.url || (data?.image?.b64_json ? `data:image/png;base64,${data.image.b64_json}` : "") }]);
      } catch (error) {
        setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: error?.message || "Image generation failed." }]);
      } finally { setLoading(false); }
      return;
    }

    setInput("");
    const next = [...messages, { role: "user", content: text }];
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

      setMessages((current) => [...current, { role: "assistant", content: "" }]);

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
                  copy[copy.length - 1] = { role: "assistant", content: answer };
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

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(index);
      setTimeout(() => setCopied(null), 1400);
    } catch {}
  };

  const active = modes.find((item) => item.id === mode) || modes[0];

  return (
    <main className="shell">
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
                    <div>{message.content}</div>{message.imageUrl && <img className="generatedImage" src={message.imageUrl} alt="Generated by Flash AI" />}
                    {message.role === "assistant" && message.content && (
                      <button className="copy" onClick={() => copyMessage(message.content, index)}>
                        {copied === index ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="msg assistant"><div className="typing">Generating<span>.</span><span>.</span><span>.</span></div></div>}
            </div>
          )}
        </div>

        <div className="composer">
          <div className="modebar">
            <span>{active.label}</span>
            <small>{active.hint}</small>
            {mode === "image" ? (
              <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} aria-label="Image model">
                {imageModels.map((m) => {
                  const id = m?.id || m;
                  return <option key={id} value={id}>{m?.name || id}</option>;
                })}
              </select>
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
            <button className="send" onClick={send} disabled={loading || !input.trim()}><Send size={18} /></button>
          </div>
          <small>Flash AI can make mistakes. Verify important information.</small>
        </div>
        {settingsOpen && (
          <div className="settingsOverlay" onClick={() => setSettingsOpen(false)}>
            <div className="settingsPanel" onClick={(e) => e.stopPropagation()}>
              <div className="settingsHeader">
                <div><b>Flash AI Settings</b><small>Provider and workspace controls</small></div>
                <button className="icon" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
              </div>
              <label>Text model<select value={textModel} onChange={(e) => setTextModel(e.target.value)}>
                {textModels.map((m) => { const id = m?.id || m; return <option key={id} value={id}>{m?.name || id}</option>; })}
              </select></label>
              <label>Image model<select value={imageModel} onChange={(e) => setImageModel(e.target.value)}>
                {imageModels.map((m) => { const id = m?.id || m; return <option key={id} value={id}>{m?.name || id}</option>; })}
              </select></label>
              <div className="service"><span className="status" /> {serviceStatus}</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
