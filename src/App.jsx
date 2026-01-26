import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, Plus, Trash2, Menu, Lightbulb, Cloud, Check, RefreshCw, 
  FileText, Copy, X, Hash, ChevronLeft, Share2, Users, Link as LinkIcon
} from 'lucide-react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const App = () => {
  // --- States ---
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentSongId, setCurrentSongId] = useState(() => {
    try { return localStorage.getItem('lyric-note-id') || null; } catch (e) { return null; }
  });
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);
  
  const textareaRef = useRef(null);
  const lastChangeFromMe = useRef(false);

  // --- Auth Setup ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Real-time Sync (Multiple Users / Shared Editing) ---
  useEffect(() => {
    if (!user) return;
    
    // 公開データとして保存することで共有を可能にする
    const songsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'songs');
    
    const unsubscribe = onSnapshot(songsCollection, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date()
      }));
      
      loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      
      // 自分が送った変更でない場合のみ状態を更新（カーソル飛び防止）
      if (!lastChangeFromMe.current) {
        setSongs(loaded);
      }
      lastChangeFromMe.current = false;
      
      setIsLoading(false);
      if (loaded.length > 0 && !currentSongId) setCurrentSongId(loaded[0].id);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, appId]);

  useEffect(() => {
    if (currentSongId) localStorage.setItem('lyric-note-id', currentSongId);
  }, [currentSongId]);

  const activeSong = songs.find(s => s.id === currentSongId) || { title: '', content: '', memos: '', bpm: 120 };

  // --- Actions ---
  const handleUpdate = async (field, value) => {
    if (!currentSongId || !user) return;

    // 即座にUIに反映（楽観的更新）
    setSongs(prev => prev.map(s => s.id === currentSongId ? { ...s, [field]: value } : s));
    
    setSaveStatus('saving');
    lastChangeFromMe.current = true;
    
    try {
      const songRef = doc(db, 'artifacts', appId, 'public', 'data', 'songs', currentSongId);
      await updateDoc(songRef, { 
        [field]: value, 
        updatedAt: serverTimestamp(),
        lastEditor: user.uid 
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const addNewTrack = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'songs'), {
        title: 'New Session',
        content: '',
        memos: '',
        bpm: 120,
        creator: user.uid,
        updatedAt: serverTimestamp()
      });
      setCurrentSongId(docRef.id);
      showNotify("新しい共同編集セッションを開始しました");
    } catch (e) { console.error(e); }
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?track=${currentSongId}`;
    const el = document.createElement('textarea');
    el.value = shareUrl;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showNotify("共有リンクをコピーしました（同時編集可能）");
  };

  const showNotify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
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

  if (isLoading) return (
    <div className="h-screen bg-[#020617] flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  const tags = ['Intro', 'Verse', 'Hook', 'Chorus', 'Bridge', 'Outro'];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className={`relative h-full bg-[#0f172a] border-r border-slate-800/50 transition-all duration-500 ease-in-out z-40 flex-shrink-0 ${isSidebarOpen ? 'w-80' : 'w-0 -translate-x-full'}`}>
        <div className="flex flex-col h-full w-80">
          <div className="p-8 flex items-center gap-3 font-black text-2xl tracking-tighter text-white">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Music className="w-6 h-6" />
            </div>
            LYRIC NOTE
          </div>
          
          <div className="px-6 pb-6">
            <button onClick={addNewTrack} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 text-white shadow-xl shadow-indigo-600/10">
              <Plus className="w-5 h-5" /> New Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-10 custom-scrollbar">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent Sessions</div>
            {songs.map(s => (
              <div 
                key={s.id} 
                onClick={() => setCurrentSongId(s.id)} 
                className={`group p-4 rounded-2xl cursor-pointer flex items-center justify-between transition-all duration-300 ${currentSongId === s.id ? 'bg-slate-800 text-white shadow-lg ring-1 ring-slate-700' : 'text-slate-500 hover:bg-slate-800/40'}`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-semibold text-base">{s.title || 'Untitled Session'}</span>
                  <span className="text-[10px] opacity-40 font-mono mt-1 uppercase flex items-center gap-1">
                    <Users className="w-3 h-3" /> Shared Content
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(confirm('セッションを終了（削除）しますか？')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', s.id)); }} 
                  className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-24 border-b border-slate-900/50 flex items-center justify-between px-10 bg-[#020617]/80 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-6 flex-1 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
              {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <input 
              type="text" 
              value={activeSong.title} 
              onChange={(e) => handleUpdate('title', e.target.value)} 
              className="bg-transparent text-3xl font-black focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 truncate text-white placeholder:text-slate-800" 
              placeholder="Session Title..." 
            />
          </div>
          
          <div className="flex items-center gap-6 ml-6">
            <div className="flex flex-col items-end mr-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                {saveStatus === 'saving' ? (
                  <span className="text-indigo-400 flex items-center gap-2 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Syncing</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-2"><Users className="w-3 h-3" /> Live Mode</span>
                )}
              </div>
              <div className="text-slate-500 text-[10px] font-mono">BPM: {activeSong.bpm}</div>
            </div>

            <button onClick={copyShareLink} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-sm transition-all border border-indigo-600/20">
              <Share2 className="w-4 h-4" /> Share
            </button>

            <div className="h-10 w-px bg-slate-800" />

            <button onClick={() => setShowMemos(!showMemos)} className={`p-3 rounded-xl transition-all border ${showMemos ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 border-transparent'}`}>
              <FileText className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-10 py-4 border-b border-slate-900/50 bg-slate-950/20">
          <Hash className="w-4 h-4 text-slate-700" />
          {tags.map(t => (
            <button key={t} onClick={() => insertTag(t)} className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all uppercase tracking-widest">
              {t}
            </button>
          ))}
        </div>

        {/* Editor Area - Main Content focus */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
            <textarea 
              ref={textareaRef} 
              value={activeSong.content} 
              onChange={(e) => handleUpdate('content', e.target.value)} 
              className="flex-1 p-16 md:p-32 bg-transparent resize-none focus:outline-none text-4xl md:text-5xl lg:text-6xl leading-snug text-slate-100 placeholder:text-slate-900 custom-scrollbar font-bold" 
              placeholder="ここにリリックを解き放つ..." 
              spellCheck="false" 
            />
            
            {/* Real-time Status indicator */}
            <div className="absolute bottom-10 left-10 flex items-center gap-3 p-4 bg-slate-900/50 rounded-2xl backdrop-blur-md border border-slate-800">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Collaborative Session Active</span>
            </div>
          </div>
          
          {/* Memo Sidepane */}
          <div className={`relative h-full bg-[#020617] border-l border-slate-900 transition-all duration-500 ease-in-out ${showMemos ? 'w-[450px]' : 'w-0 overflow-hidden translate-x-full'}`}>
            <div className="flex flex-col h-full w-[450px]">
              <div className="p-8 border-b border-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
                  <Lightbulb className="w-4 h-4 text-yellow-500" /> Shared Idea Box
                </span>
                <button onClick={() => setShowMemos(false)} className="p-2 text-slate-600 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea 
                value={activeSong.memos} 
                onChange={(e) => handleUpdate('memos', e.target.value)} 
                className="flex-1 p-10 bg-transparent resize-none focus:outline-none text-xl text-slate-400 leading-relaxed placeholder:text-slate-900 font-medium" 
                placeholder="韻の候補、構成のフロー、刹那的なアイデアを共有..." 
                spellCheck="false" 
              />
            </div>
          </div>
        </div>
      </main>

      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-10 py-5 rounded-3xl shadow-2xl shadow-indigo-600/40 text-sm font-black z-[100] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <LinkIcon className="w-5 h-5" />{notification}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        textarea::placeholder { transition: all 0.4s ease; }
        textarea:focus::placeholder { opacity: 0.1; transform: translateY(-10px); }
      `}} />
    </div>
  );
};

export default App;