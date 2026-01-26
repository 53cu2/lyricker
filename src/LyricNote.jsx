import { useEffect, useRef, useState } from "react";
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
import "./LyricNote.css";

/* =========================
   Utils
========================= */
const getSessionIdFromURL = () => {
  const p = new URLSearchParams(window.location.search);
  return p.get("session");
};

const genId = () => Math.random().toString(36).slice(2, 8);

/* =========================
   Component
========================= */
export default function LyricNote() {
  const [sessions, setSessions] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [memos, setMemos] = useState("");
  const [bpm, setBpm] = useState(120);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const saveTimer = useRef(null);

  /* =========================
     Sessions list
  ========================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sessions"), snap => {
      setSessions(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });
    return () => unsub();
  }, []);

  /* =========================
     Load from URL
  ========================= */
  useEffect(() => {
    const sid = getSessionIdFromURL();
    if (sid) setCurrentSong({ id: sid });
  }, []);

  /* =========================
     Realtime song sync
  ========================= */
  useEffect(() => {
    if (!currentSong) return;

    const unsub = onSnapshot(doc(db, "sessions", currentSong.id), snap => {
      const d = snap.data();
      if (!d) return;
      setTitle(d.title || "");
      setContent(d.content || "");
      setMemos(d.memos || "");
      setBpm(d.bpm || 120);
    });

    return () => unsub();
  }, [currentSong]);

  /* =========================
     Realtime chat
  ========================= */
  useEffect(() => {
    if (!currentSong) return;

    const q = query(
      collection(db, "sessions", currentSong.id, "chat"),
      orderBy("createdAt")
    );

    const unsub = onSnapshot(q, snap => {
      setChatMessages(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, [currentSong]);

  /* =========================
     Actions
  ========================= */
  const createNewSession = async () => {
    const id = genId();
    await setDoc(doc(db, "sessions", id), {
      title: "Untitled",
      content: "",
      memos: "",
      bpm: 120,
      createdAt: serverTimestamp()
    });
    window.history.pushState({}, "", `?session=${id}`);
    setCurrentSong({ id });
  };

  const autoSave = data => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(doc(db, "sessions", currentSong.id), data, { merge: true });
    }, 500);
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    await addDoc(
      collection(db, "sessions", currentSong.id, "chat"),
      {
        user: auth.currentUser.uid.slice(0, 6),
        message: chatInput,
        createdAt: serverTimestamp()
      }
    );
    setChatInput("");
  };

  const share = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}?session=${currentSong.id}`
    );
    alert("Invite link copied");
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="ln-root">
      {/* Sidebar */}
      <aside className="ln-side">
        <h2>🎵 Lyric Note</h2>
        <button onClick={createNewSession}>＋ New Session</button>

        <div className="ln-sessions">
          {sessions.map(s => (
            <div
              key={s.id}
              className={
                currentSong?.id === s.id ? "active" : ""
              }
              onClick={() => {
                window.history.pushState({}, "", `?session=${s.id}`);
                setCurrentSong({ id: s.id });
              }}
            >
              {s.title || s.id}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="ln-main">
        {/* Top bar */}
        <div className="ln-top">
          <input
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              autoSave({ title: e.target.value });
            }}
            className="ln-title"
          />

          <div className="ln-top-right">
            <input
              type="number"
              value={bpm}
              onChange={e => {
                setBpm(e.target.value);
                autoSave({ bpm: Number(e.target.value) });
              }}
              className="ln-bpm"
            />
            <button onClick={share}>Share</button>
          </div>
        </div>

        {/* Editor */}
        <div className="ln-editor-wrap">
          <textarea
            className="ln-editor"
            value={content}
            onChange={e => {
              setContent(e.target.value);
              autoSave({ content: e.target.value });
            }}
            placeholder="Start writing your lyrics..."
          />

          {/* Memo */}
          <textarea
            className="ln-memo"
            value={memos}
            onChange={e => {
              setMemos(e.target.value);
              autoSave({ memos: e.target.value });
            }}
            placeholder="Ideas & Rhymes..."
          />
        </div>

        {/* Chat */}
        <div className="ln-chat">
          <div className="ln-chat-log">
            {chatMessages.map(m => (
              <div key={m.id}>
                <b>{m.user}</b>: {m.message}
              </div>
            ))}
          </div>

          <div className="ln-chat-input">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      </main>
    </div>
  );
}
