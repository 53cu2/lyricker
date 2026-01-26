import { useEffect, useState } from "react";
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";

const SECTIONS = ["intro", "verse", "chorus", "bridge"];
const SESSION_ID = "demo-session";

export default function LyricNote() {
  const [username, setUsername] = useState("");
  const [active, setActive] = useState("verse");
  const [sections, setSections] = useState({
    intro: "",
    verse: "",
    chorus: "",
    bridge: ""
  });
  const [users, setUsers] = useState([]);

  /* ===== username ===== */
  useEffect(() => {
    let name = localStorage.getItem("username");
    if (!name) {
      name = prompt("username?");
      localStorage.setItem("username", name);
    }
    setUsername(name);
  }, []);

  /* ===== realtime lyrics ===== */
  useEffect(() => {
    const ref = doc(db, "sessions", SESSION_ID);
    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        setSections(snap.data().sections);
      }
    });
  }, []);

  const save = next => {
    setDoc(
      doc(db, "sessions", SESSION_ID),
      {
        sections: next,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  };

  /* ===== presence ===== */
  useEffect(() => {
    if (!auth.currentUser || !username) return;

    const ref = doc(
      db,
      "sessions",
      SESSION_ID,
      "presence",
      auth.currentUser.uid
    );

    setDoc(ref, {
      name: username,
      section: active,
      updatedAt: serverTimestamp()
    });
  }, [active, username]);

  useEffect(() => {
    return onSnapshot(
      collection(db, "sessions", SESSION_ID, "presence"),
      snap => {
        setUsers(snap.docs.map(d => d.data()));
      }
    );
  }, []);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900">
        <h1 className="text-xl font-bold tracking-wide">Lyric Note</h1>
        <div className="flex gap-3 text-xs text-indigo-300">
          {users.map((u, i) => (
            <span key={i}>
              ✏ {u.name} ({u.section})
            </span>
          ))}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 px-6 py-3 border-b border-slate-800">
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={`px-4 py-1 rounded-md text-sm font-semibold transition
              ${
                active === s
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Editor */}
      <textarea
        className="
          flex-1 w-full resize-none bg-transparent
          px-6 py-4 text-2xl font-bold
          outline-none leading-relaxed
        "
        placeholder="Write your lyrics..."
        value={sections[active]}
        onChange={e => {
          const next = { ...sections, [active]: e.target.value };
          setSections(next);
          save(next);
        }}
        spellCheck={false}
      />
    </div>
  );
}
