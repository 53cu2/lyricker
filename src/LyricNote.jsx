import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

/* =====================
   utils
===================== */
const getSessionId = () => {
  const p = new URLSearchParams(window.location.search);
  return p.get("session");
};

/* =====================
   Component
===================== */
export default function LyricNote() {
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const typingTimer = useRef(null);

  /* =====================
     初期ロード
  ===================== */
  useEffect(() => {
    const sid = getSessionId();
    if (sid) {
      setSessionId(sid);
    } else {
      createSession();
    }
  }, []);

  /* =====================
     セッション作成
  ===================== */
  const createSession = async () => {
    const ref = doc(collection(db, "sessions"));
    await setDoc(ref, {
      title: "Untitled Session",
      content: "",
      createdAt: serverTimestamp()
    });
    window.history.replaceState(null, "", `?session=${ref.id}`);
    setSessionId(ref.id);
  };

  /* =====================
     リアルタイム編集
  ===================== */
  useEffect(() => {
    if (!sessionId) return;

    const unsub = onSnapshot(doc(db, "sessions", sessionId), snap => {
      const d = snap.data();
      if (!d) return;
      setTitle(d.title);
      setContent(d.content);
    });

    return () => unsub();
  }, [sessionId]);

  const handleContentChange = e => {
    const v = e.target.value;
    setContent(v);

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setDoc(
        doc(db, "sessions", sessionId),
        {
          content: v,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }, 500);
  };

  /* =====================
     チャット同期
  ===================== */
  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, "sessions", sessionId, "chat"),
      orderBy("createdAt")
    );

    const unsub = onSnapshot(q, snap => {
      setChatMessages(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [sessionId]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    await addDoc(
      collection(db, "sessions", sessionId, "chat"),
      {
        user: auth.currentUser.uid.slice(0, 6),
        message: chatInput,
        createdAt: serverTimestamp()
      }
    );
    setChatInput("");
  };

  /* =====================
     招待リンク
  ===================== */
  const share = () => {
    const url = `${window.location.origin}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    alert("Invite link copied");
  };

  /* =====================
     UI
  ===================== */
  return (
    <div style={{ padding: 24, background: "#020617", color: "white", height: "100vh" }}>
      <h1>🔥 Lyric Note</h1>

      <button onClick={share}>Invite Link</button>

      <div style={{ marginTop: 16 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          style={{ width: "100%", marginBottom: 8 }}
        />

        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Write lyrics together..."
          rows={10}
          style={{ width: "100%" }}
        />
      </div>

      <h3>Chat</h3>
      <div style={{ height: 120, overflowY: "auto", background: "#111", padding: 8 }}>
        {chatMessages.map(m => (
          <div key={m.id}>
            <b>{m.user}</b>: {m.message}
          </div>
        ))}
      </div>

      <input
        value={chatInput}
        onChange={e => setChatInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && sendMessage()}
        placeholder="message"
        style={{ width: "100%", marginTop: 8 }}
      />
    </div>
  );
}
