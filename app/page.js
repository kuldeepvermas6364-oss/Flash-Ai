'use client';
import {useState} from "react";
import {Sparkles,Plus,MessageSquare,Search,Code2,Image,Paperclip,Send,Settings,History,Menu} from "lucide-react";
export default function Home(){
 const [input,setInput]=useState(""); const [messages,setMessages]=useState([]);
 const send=()=>{if(!input.trim())return;setMessages(m=>[...m,{role:"user",text:input.trim()}]);setInput("")};
 return <main className="shell">
  <aside className="sidebar"><div className="brand"><div className="logo"><Sparkles size={20}/></div><div><b>Flash AI</b><small>Professional AI</small></div></div>
   <button className="new" onClick={()=>setMessages([])}><Plus size={18}/> New chat</button>
   <nav><a className="active"><MessageSquare size={17}/> Chat</a><a><Search size={17}/> Research</a><a><Code2 size={17}/> Code</a><a><Image size={17}/> Create</a></nav>
   <div className="history"><span><History size={15}/> Recent</span><p>No conversations yet</p></div>
   <button className="settings"><Settings size={17}/> Settings</button>
  </aside>
  <section className="main"><header><button className="mobile"><Menu/></button><div><span className="status"></span> Flash AI <small>Online</small></div><button className="icon"><Settings size={18}/></button></header>
   <div className="content">{messages.length===0?<div className="hero"><div className="heroicon"><Sparkles size={30}/></div><h1>What can I help you <em>create?</em></h1><p>Chat, research, code, analyze files and create with one professional AI workspace.</p><div className="cards"><button><Search/><b>Research</b><small>Find and synthesize information</small></button><button><Code2/><b>Code</b><small>Build, debug and explain code</small></button><button><Image/><b>Create</b><small>Generate creative ideas and visuals</small></button></div></div>:<div className="messages">{messages.map((m,i)=><div key={i} className={"msg "+m.role}><div>{m.text}</div></div>)}</div>}</div>
   <div className="composer"><div className="input"><button title="Attach"><Paperclip size={19}/></button><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask Flash AI anything..."/><button className="send" onClick={send}><Send size={18}/></button></div><small>Flash AI can make mistakes. Verify important information.</small></div>
  </section>
 </main>
}