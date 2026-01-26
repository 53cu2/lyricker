import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, Plus, Trash2, Menu, Lightbulb, Cloud, Check, RefreshCw, FileText, Copy, X, Hash, ChevronLeft, ChevronRight
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);
  
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // --- Tailwind Setup (1920x1080 Optimized) ---
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
                slate: { 900: '#0f172a', 950: '#020617' },
                indigo: { 500: '#6366f1', 600: '#4f46e5' }
              },
              fontSize: {
                '3xl': '1.875rem',
                '4xl': '2.25rem',
                '5xl': '3.5rem',
              }
            }
          }
        }
      `;
      document.head.appendChild(config);
    }
  }, []);

  // --- Firebase Sync ---
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
    }, (error) => {
      console.error("Firestore error:", error);
      setIsLoading(false);
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
      const newPos = start + tagText.length;
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const addNewTrack = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs'), {
        title: 'New Track', content: '', memos: '', bpm: 120, updatedAt: serverTimestamp()
      });
      setCurrentSongId(docRef.id);
      setNotification("新規トラックを作成しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) { console.error(e); }
  };

  const copyToClipboard = () => {
    const text = `${activeSong.title}\nBPM: ${activeSong.bpm}\n\n${activeSong.content}`;
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setNotification("クリップボードにコピーしました");
    setTimeout(() => setNotification(null), 2000);
  };

  if (isLoading) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
        <span className="text-slate-500 font-mono tracking-widest text-xs uppercase">Loading Environment</span>
      </div>
    </div>
  );

  const tags = ['Intro', 'Verse', 'Hook', 'Chorus', 'Bridge', 'Outro', 'Pre-Chorus'];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar - Wide Screen Optimized */}
      <aside className={`relative h-full bg-slate-900 border-r border-slate-800/50 transition-all duration-500 ease-in-out shadow-2xl flex-shrink-0 ${isSidebarOpen ? 'w-80' : 'w-0 -translate-x-full'}`}>
        <div className="flex flex-col h-full w-80">
          <div className="p-8 border-b border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3 font-black text-2xl tracking-tighter text-white">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Music className="w-6 h-6 text-white" />
              </div>
              LYRIC NOTE
            </div>
          </div>
          <div className="p-6">
            <button onClick={addNewTrack} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-indigo-600/10 text-white">
              <Plus className="w-5 h-5" /> New Track
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-10 custom-scrollbar">
            {songs.map(s => (
              <div 
                key={s.id} 
                onClick={() => setCurrentSongId(s.id)} 
                className={`group p-4 rounded-2xl cursor-pointer flex items-center justify-between transition-all duration-300 ${currentSongId === s.id ? 'bg-slate-800 text-white shadow-xl ring-1 ring-slate-700' : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300'}`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-semibold text-base">{s.title || 'Untitled'}</span>
                  <span className="text-[10px] opacity-40 font-mono mt-1 uppercase">Track ID: {s.id.slice(0,8)}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(confirm('削除しますか？')) deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', s.id)); }} 
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-[#020617]">
        <header className="h-24 border-b border-slate-900/50 flex items-center justify-between px-10 bg-[#020617]/80 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-6 flex-1 overflow-hidden">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex flex-col flex-1 max-w-3xl">
              <input 
                type="text" 
                value={activeSong.title} 
                onChange={(e) => handleUpdate('title', e.target.value)} 
                className="bg-transparent text-3xl font-black focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 truncate placeholder:text-slate-800 text-white" 
                placeholder="Track Title..." 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-8 ml-6">
            <div className="flex flex-col items-end">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">
                {saveStatus === 'saving' ? (
                  <span className="text-indigo-400 flex items-center gap-2 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Auto Saving</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-2"><Cloud className="w-3 h-3" /> Cloud Synced</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono">
                BPM: <input type="number" value={activeSong.bpm} onChange={(e) => handleUpdate('bpm', e.target.value)} className="bg-transparent w-8 text-indigo-400 focus:outline-none focus:text-indigo-300 font-bold" />
              </div>
            </div>
            
            <div className="h-10 w-px bg-slate-800 mx-2" />

            <div className="flex items-center gap-3">
              <button onClick={copyToClipboard} className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700" title="Export Track">
                <Copy className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setShowMemos(!showMemos)} 
                className={`p-3 rounded-xl transition-all border ${showMemos ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-inner' : 'text-slate-400 hover:bg-slate-800 border-transparent hover:border-slate-700'}`}
              >
                <FileText className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Toolbar */}
        <div className="flex items-center gap-3 px-10 py-4 border-b border-slate-900/50 bg-slate-950/20 overflow-x-auto no-scrollbar">
          <Hash className="w-5 h-5 text-slate-700 shrink-0" />
          {tags.map(t => (
            <button 
              key={t} 
              onClick={() => insertTag(t)} 
              className="px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all whitespace-nowrap active:scale-95 uppercase tracking-widest"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
            <textarea 
              ref={textareaRef} 
              value={activeSong.content} 
              onChange={(e) => handleUpdate('content', e.target.value)} 
              className="flex-1 p-16 md:p-24 bg-transparent resize-none focus:outline-none text-3xl md:text-4xl lg:text-5xl leading-[1.5] text-slate-100 placeholder:text-slate-900 custom-scrollbar font-medium" 
              placeholder="ここにリリックを解き放つ..." 
              spellCheck="false" 
            />
          </div>
          
          {/* Idea/Memo Pane */}
          <div className={`relative h-full bg-slate-950/40 border-l border-slate-900/50 flex flex-col transition-all duration-500 ease-in-out ${showMemos ? 'w-[400px]' : 'w-0 overflow-hidden translate-x-full'}`}>
            <div className="flex flex-col h-full w-[400px]">
              <div className="p-6 border-b border-slate-900/50 flex items-center justify-between bg-slate-900/20">
                <span className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />Rhyme / Idea Memo
                </span>
                <button onClick={() => setShowMemos(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-600 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea 
                value={activeSong.memos} 
                onChange={(e) => handleUpdate('memos', e.target.value)} 
                className="flex-1 p-8 bg-transparent resize-none focus:outline-none text-lg text-slate-400 leading-loose placeholder:text-slate-900 font-medium" 
                placeholder="韻の候補、構成のフロー、刹那的なアイデア..." 
                spellCheck="false" 
              />
            </div>
          </div>
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-12 right-12 bg-indigo-600 text-white px-10 py-4 rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] text-sm font-black z-[100] flex items-center gap-3 animate-in slide-in-from-right-10 fade-in duration-300">
          <Check className="w-5 h-5" />{notification}
        </div>
      )}

      {/* Global Aesthetics */}
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
        textarea::placeholder { transition: all 0.5s ease; }
        textarea:focus::placeholder { opacity: 0.3; transform: translateX(10px); }
      `}} />
    </div>
  );
};

export default App;