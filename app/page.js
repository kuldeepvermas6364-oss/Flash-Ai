"use client";

import { useState } from "react";
import {
  Sparkles, Plus, MessageSquare, Search, Code2, Image, Paperclip,
  Send, Settings, History, Menu, X
} from "lucide-react";

const modes = [
  { id: "chat", label: "Chat", icon: MessageSquare, hint: "Ask anything" },
  { id: "research", label: "Research", icon: Search, hint: "Analyze a topic" },
  { id: "code", label: "Code", icon: Code2, hint: "Build and debug" },
  { id: "create", label: "Create", icon: Image, hint: "Create ideas" }
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(null);

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

    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, mode })
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

        <button className="new" onClick={() => { setMessages([]); setMobileOpen(false); }}>
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
          <p>{messages.length ? "Current conversation" : "No conversations yet"}</p>
        </div>
        <button className="settings"><Settings size={17} /> Settings</button>
      </aside>

      <section className="main">
        <header>
          <button className="mobile" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div><span className="status" /> Flash AI <small>Online</small></div>
          <button className="icon"><Settings size={18} /></button>
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
                  <div>{message.content}</div>
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
      </section>
    </main>
  );
}
