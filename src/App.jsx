import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, Plus, Trash2, Copy, Menu, X, PenTool, Clock, Lightbulb, Cloud, Check, RefreshCw, FileText, Edit3
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";

/**
 * デザインが当たらない問題を解決するために、
 * コンポーネント内でTailwind CSSを強制的に読み込む設定を追加しました。
 */

const getEnv = (key) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    const metaEnv = (new Function("return typeof import.meta !== 'undefined' ? import.meta.env : undefined"))();
    if (metaEnv && metaEnv[key]) return metaEnv[key];
  } catch (e) {}
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY') || "AIzaSyAZ62d-7q8LYljSPX0w4QOD0MxCyU9XJ1s",
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN') || "secu-lyrics.firebaseapp.com",
  projectId: getEnv('FIREBASE_PROJECT_ID') || "secu-lyrics",
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET') || "secu-lyrics.firebasestorage.app",
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID') || "512413380430",
  appId: getEnv('FIREBASE_APP_ID') || "1:512413380430:web:806f3fa9c33ea11ee6b81f",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = getEnv('APP_ID') || "secu-lyrics-prod";

const App = () => {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentSongId, setCurrentSongId] = useState(() => {
    try { return localStorage.getItem('lyric-note-current-id') || null; } catch (e) { return null; }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Tailwindを動的に読み込む（デザイン修正用）
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Auth Error", e); }
      }
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const songsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs');
    const unsubscribe = onSnapshot(songsCollection, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      loaded.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setSongs(loaded);
      setIsLoading(false);
      if (loaded.length > 0 && !currentSongId) setCurrentSongId(loaded[0].id);
    }, () => setIsLoading(false));
    return () => unsubscribe();
  }, [user, currentSongId]);

  useEffect(() => {
    if (currentSongId) localStorage.setItem('lyric-note-current-id', currentSongId);
  }, [currentSongId]);

  const activeSong = songs.find(s => s.id === currentSongId) || { title: '', content: '', memos: '', bpm: 120 };

  const debouncedSave = useCallback((songId, data) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !songId) return;
      try {
        const songRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', songId);
        await updateDoc(songRef, { ...data, updatedAt: serverTimestamp() });
        setSaveStatus('saved');
      } catch (e) { setSaveStatus('error'); }
    }, 800);
  }, [user]);

  const updateSong = (field, value) => {
    if (!currentSongId) return;
    setSongs(prev => prev.map(s => s.id === currentSongId ? { ...s, [field]: value } : s));
    const currentData = songs.find(s => s.id === currentSongId);
    if (currentData) {
      const { id, updatedAt, ...pureData } = { ...currentData, [field]: value };
      debouncedSave(currentSongId, pureData);
    }
  };

  const createNewSong = async () => {
    if (!user) return;
    try {
      const res = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs'), { 
        title: 'New Track', content: '', memos: '', bpm: 120, updatedAt: serverTimestamp() 
      });
      setCurrentSongId(res.id);
      setNotification("作成しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) {}
  };

  const deleteTrack = async (id, e) => {
    e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', id));
      if (currentSongId === id) setCurrentSongId(null);
    } catch (e) {}
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* サイドバー */}
      <aside className={`fixed md:relative z-30 w-72 h-full bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:opacity-0'}`}>
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-400"><Music className="w-6 h-6" /><span>Lyric Note</span></div>
        </div>
        <div className="p-4">
          <button onClick={createNewSong} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-medium transition-colors">
            <Plus className="w-5 h-5" />New Track
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {songs.map(s => (
            <div key={s.id} onClick={() => setCurrentSongId(s.id)} className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${currentSongId === s.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/50 text-slate-400'}`}>
              <div className="font-medium truncate flex-1">{s.title || 'No Title'}</div>
              <button onClick={(e) => deleteTrack(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col bg-slate-900 min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><Menu className="w-6 h-6" /></button>
            <input type="text" value={activeSong.title} onChange={(e) => updateSong('title', e.target.value)} className="bg-transparent text-xl font-bold focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30" placeholder="Track Title" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono uppercase text-slate-500">
              {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <Cloud className="w-4 h-4 text-emerald-500" />}
            </div>
            <button onClick={() => setShowMemos(!showMemos)} className={`p-2 rounded-lg transition-colors ${showMemos ? 'text-yellow-500 bg-slate-800' : 'text-slate-400'}`}><Lightbulb className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <textarea ref={textareaRef} value={activeSong.content} onChange={(e) => updateSong('content', e.target.value)} className="flex-1 p-8 md:p-12 bg-transparent resize-none focus:outline-none text-lg leading-relaxed text-slate-200" placeholder="歌詞をここに書き留めてください..." spellCheck="false" />
          {showMemos && (
            <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-950/20">
              <div className="p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-800 flex items-center gap-2"><FileText className="w-4 h-4" /> Memo / Ideas</div>
              <textarea value={activeSong.memos} onChange={(e) => updateSong('memos', e.target.value)} className="flex-1 p-4 bg-transparent resize-none focus:outline-none text-sm text-slate-400 leading-relaxed" placeholder="ライムの候補やアイデア..." />
            </div>
          )}
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full shadow-2xl text-sm z-50 animate-bounce">
          <Check className="inline-block mr-2 w-4 h-4" />{notification}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;