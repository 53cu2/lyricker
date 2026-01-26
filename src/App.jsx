import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, Plus, Trash2, Menu, Lightbulb, Cloud, Check, RefreshCw, FileText, Copy, X, Hash
} from 'lucide-react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAZ62d-7q8LYljSPX0w4QOD0MxCyU9XJ1s",
  authDomain: "secu-lyrics.firebaseapp.com",
  projectId: "secu-lyrics",
  storageBucket: "secu-lyrics.firebasestorage.app",
  messagingSenderId: "512413380430",
  appId: "1:512413380430:web:806f3fa9c33ea11ee6b81f",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = "secu-lyrics-prod";

const App = () => {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentSongId, setCurrentSongId] = useState(() => {
    try { return localStorage.getItem('lyric-note-id') || null; } catch (e) { return null; }
  });
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMemos, setShowMemos] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // --- Tailwind CDN Setup ---
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
      
      const config = document.createElement('script');
      config.innerHTML = `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                slate: { 950: '#020617' },
                indigo: { 500: '#6366f1', 600: '#4f46e5' }
              }
            }
          }
        }
      `;
      document.head.appendChild(config);
    }
  }, []);

  // --- Auth & Sync ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
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
        updatedAt: d.data().updatedAt?.toDate?.() || new Date()
      }));
      loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      setSongs(loaded);
      setIsLoading(false);
      if (loaded.length > 0 && !currentSongId) setCurrentSongId(loaded[0].id);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (currentSongId) localStorage.setItem('lyric-note-id', currentSongId);
  }, [currentSongId]);

  const activeSong = songs.find(s => s.id === currentSongId) || { title: '', content: '', memos: '', bpm: 120 };

  const handleUpdate = (field, value) => {
    if (!currentSongId) return;
    setSongs(prev => prev.map(s => s.id === currentSongId ? { ...s, [field]: value } : s));
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const songRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', currentSongId);
        await updateDoc(songRef, { [field]: value, updatedAt: serverTimestamp() });
        setSaveStatus('saved');
      } catch (e) { setSaveStatus('error'); }
    }, 1000);
  };

  const insertTag = (tag) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = activeSong.content || '';
    const tagText = `[${tag}]\n`;
    const newContent = text.substring(0, start) + tagText + text.substring(end);
    handleUpdate('content', newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tagText.length, start + tagText.length);
    }, 10);
  };

  const addNewTrack = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs'), {
        title: 'New Track', content: '', memos: '', bpm: 120, updatedAt: serverTimestamp()
      });
      setCurrentSongId(docRef.id);
      setIsSidebarOpen(false);
      setNotification("作成しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) {}
  };

  const copyToClipboard = () => {
    const text = `${activeSong.title}\nBPM: ${activeSong.bpm}\n\n${activeSong.content}`;
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setNotification("コピーしました");
    setTimeout(() => setNotification(null), 2000);
  };

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  const tags = ['Intro', 'Verse', 'Hook', 'Chorus', 'Bridge', 'Outro'];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-40 md:hidden animate-in fade-in duration-200" />}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-50 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 shadow-2xl ${isSidebarOpen ? 'w-72' : 'w-0 -translate-x-full md:translate-x-0 md:w-64'}`}>
        <div className="flex flex-col h-full w-72 md:w-64">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-lg tracking-tighter text-indigo-400"><Music className="w-5 h-5" />LYRIC NOTE</div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-800 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4"><button onClick={addNewTrack} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"><Plus className="w-5 h-5" />New Track</button></div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-10">
            {songs.map(s => (
              <div key={s.id} onClick={() => { setCurrentSongId(s.id); setIsSidebarOpen(false); }} className={`group p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${currentSongId === s.id ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-800/40'}`}>
                <span className="truncate font-medium text-sm">{s.title || 'Untitled'}</span>
                <button onClick={(e) => { e.stopPropagation(); if(confirm('削除しますか？')) deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', s.id)); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-slate-950">
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-4 md:px-6 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><Menu className="w-6 h-6" /></button>
            <input type="text" value={activeSong.title} onChange={(e) => handleUpdate('title', e.target.value)} className="bg-transparent text-lg md:text-xl font-bold focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 truncate" placeholder="Untitled..." />
          </div>
          <div className="flex items-center gap-2 md:gap-5 ml-2">
            <div className="hidden sm:block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
              {saveStatus === 'saving' ? <RefreshCw className="w-3 h-3 animate-spin text-indigo-500 inline mr-1" /> : <Cloud className="w-3 h-3 text-emerald-500 inline mr-1" />}
              {saveStatus === 'saving' ? 'Saving' : 'Synced'}
            </div>
            <button onClick={copyToClipboard} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Copy"><Copy className="w-5 h-5" /></button>
            <button onClick={() => setShowMemos(!showMemos)} className={`p-2 rounded-lg transition-all ${showMemos ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:bg-slate-800'}`}><FileText className="w-6 h-6" /></button>
          </div>
        </header>

        {/* Structure Tags Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-900 bg-slate-950/30 overflow-x-auto no-scrollbar">
          <Hash className="w-4 h-4 text-slate-600 shrink-0" />
          {tags.map(t => (
            <button key={t} onClick={() => insertTag(t)} className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all whitespace-nowrap active:scale-90">{t}</button>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <textarea ref={textareaRef} value={activeSong.content} onChange={(e) => handleUpdate('content', e.target.value)} className="flex-1 p-6 md:p-12 bg-transparent resize-none focus:outline-none text-xl md:text-3xl leading-relaxed text-slate-200 placeholder:text-slate-800 custom-scrollbar" placeholder="ここにリリックを書き込む..." spellCheck="false" />
          
          {/* Memo Area (Responsive) */}
          <div className={`fixed inset-y-0 right-0 w-80 md:relative md:w-80 md:translate-x-0 bg-slate-900 md:bg-slate-950/20 border-l border-slate-900 flex flex-col transition-transform duration-300 z-40 ${showMemos ? 'translate-x-0' : 'translate-x-full md:hidden'}`}>
            <div className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 flex justify-between items-center">
              <span className="flex items-center gap-2"><Lightbulb className="w-3 h-3 text-yellow-500" />Memo</span>
              <button onClick={() => setShowMemos(false)} className="md:hidden p-1"><X className="w-4 h-4" /></button>
            </div>
            <textarea value={activeSong.memos} onChange={(e) => handleUpdate('memos', e.target.value)} className="flex-1 p-5 bg-transparent resize-none focus:outline-none text-sm text-slate-400 leading-relaxed placeholder:text-slate-800" placeholder="韻、構成案、アイデアなど..." spellCheck="false" />
          </div>
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl text-sm font-bold z-[100] flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-300">
          <Check className="w-4 h-4" />{notification}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        textarea::selection { background: #4f46e5; color: white; }
      `}} />
    </div>
  );
};

export default App;