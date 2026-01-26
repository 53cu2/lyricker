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
 * デザイン崩れを100%解決するためのコード
 * Tailwindが当たらない環境でも、ブラウザ側で強制的にレンダリングさせます。
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

  // 重要: Tailwindを強制的にページに注入する
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn-script')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn-script';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
      
      // Tailwindの設定も注入（カスタムカラー用）
      const configScript = document.createElement('script');
      configScript.innerHTML = `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                slate: { 950: '#020617' }
              }
            }
          }
        }
      `;
      document.head.appendChild(configScript);
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
    if (currentSongId) {
      try { localStorage.setItem('lyric-note-current-id', currentSongId); } catch(e) {}
    }
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
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden w-full">
      {/* サイドバー */}
      <aside className={`fixed md:relative z-30 w-72 h-full bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:hidden'}`}>
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-400">
            <Music className="w-6 h-6 shrink-0" />
            <span className="whitespace-nowrap">Lyric Note</span>
          </div>
        </div>
        <div className="p-4">
          <button onClick={createNewSong} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-medium transition-all transform active:scale-95 shadow-lg shadow-indigo-500/20">
            <Plus className="w-5 h-5" />New Track
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
          {songs.map(s => (
            <div key={s.id} onClick={() => setCurrentSongId(s.id)} className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-all ${currentSongId === s.id ? 'bg-slate-700 text-white shadow-inner' : 'hover:bg-slate-700/50 text-slate-400'}`}>
              <div className="font-medium truncate flex-1 pr-2">{s.title || 'No Title'}</div>
              <button onClick={(e) => deleteTrack(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {songs.length === 0 && !isLoading && <div className="text-center p-8 text-slate-500 text-xs">No tracks found.</div>}
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col bg-slate-900 min-w-0 relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
            <input type="text" value={activeSong.title} onChange={(e) => updateSong('title', e.target.value)} className="bg-transparent text-xl font-bold focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 transition-all placeholder:text-slate-700" placeholder="Untitled Track" />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="hidden sm:flex items-center text-xs font-mono uppercase tracking-tighter text-slate-500">
              {saveStatus === 'saving' ? (
                <span className="text-indigo-400 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> saving</span>
              ) : (
                <span className="text-emerald-500 flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5" /> synced</span>
              )}
            </div>
            <button onClick={() => setShowMemos(!showMemos)} className={`p-2 rounded-lg transition-all ${showMemos ? 'text-yellow-500 bg-slate-800 shadow-lg shadow-yellow-500/5' : 'text-slate-400 hover:bg-slate-800'}`}><Lightbulb className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 relative bg-slate-900">
            <textarea ref={textareaRef} value={activeSong.content} onChange={(e) => updateSong('content', e.target.value)} className="flex-1 p-8 md:p-12 lg:p-16 bg-transparent resize-none focus:outline-none text-lg md:text-2xl leading-relaxed text-slate-200 placeholder:text-slate-800 selection:bg-indigo-500/30" placeholder="ここにリリックを綴ってください..." spellCheck="false" />
          </div>
          
          {showMemos && (
            <div className="hidden lg:flex w-96 border-l border-slate-800 flex-col bg-slate-950/30 transition-all duration-300">
              <div className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 flex items-center gap-2 bg-slate-900/50"><FileText className="w-4 h-4" /> Memo & Ideas</div>
              <textarea value={activeSong.memos} onChange={(e) => updateSong('memos', e.target.value)} className="flex-1 p-6 bg-transparent resize-none focus:outline-none text-sm text-slate-400 leading-relaxed placeholder:text-slate-800" placeholder="韻の候補、構成案、フロウのアイデアなど..." spellCheck="false" />
            </div>
          )}
        </div>
      </main>

      {/* 通知 */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl text-sm font-bold z-50 flex items-center gap-2 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4" />{notification}
        </div>
      )}

      {/* スタイル調整 */}
      <style dangerouslySetInnerHTML={{ __html: `
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        textarea::placeholder { transition: color 0.3s ease; }
        textarea:focus::placeholder { color: #1e293b; }
      `}} />
    </div>
  );
};

export default App;