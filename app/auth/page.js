"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set, serverTimestamp } from "firebase/database";
import { auth, db } from "../../lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/");
    });
  }, [router]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (signUp && !name.trim()) return setError("Please enter your name.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      let user;
      if (signUp) {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        user = result.user;
        await updateProfile(user, { displayName: name.trim() });
        await set(ref(db, "users/" + user.uid + "/profile"), {
          name: name.trim(),
          email: user.email,
          createdAt: serverTimestamp()
        });
      } else {
        user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
      }
      router.replace("/");
    } catch (e) {
      const messages = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/invalid-email": "Please enter a valid email.",
        "auth/weak-password": "Choose a stronger password."
      };
      setError(messages[e?.code] || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authBrand"><span>✦</span><b>Flash AI</b></div>
        <p className="authEyebrow">Professional AI Workspace</p>
        <h1>{signUp ? "Create your account" : "Welcome back"}</h1>
        <p className="authSub">Sign in to keep your chats and AI workspace synced.</p>
        <form onSubmit={submit}>
          {signUp && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" /></label>}
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" /></label>
          <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={signUp ? "new-password" : "current-password"} placeholder="••••••••" /></label>
          {error && <div className="authError">{error}</div>}
          <button disabled={busy}>{busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}</button>
        </form>
        <button className="authSwitch" onClick={() => { setSignUp(!signUp); setError(""); }}>
          {signUp ? "Already have an account? Sign in" : "New to Flash AI? Create an account"}
        </button>
      </section>
    </main>
  );
}
