import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, 
  Plus, 
  Trash2, 
  Save, 
  Copy, 
  Menu, 
  X, 
  PenTool, 
  Clock, 
  Lightbulb,
  Cloud,
  Check,
  RefreshCw,
  FileText,
  Edit3
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";

/**
 * --- Vercel デプロイ用の設定 ---
 * 環境変数の参照エラーを回避するため、安全な取得メソッドを定義します。
 */

const getSafeEnv = (key) => {
  try {
    // import.meta.env が存在しない環境でのエラーを回避
    return import.meta.env[key];
  } catch (e) {
    return undefined;
  }
};

const getFirebaseConfig = () => {
  // 1. Vite/Vercel 環境変数 (VITE_*) をチェック
  const apiKey = getSafeEnv('FIREBASE_API_KEY');
  if (apiKey) {
    return {
      apiKey: apiKey,
      authDomain: getSafeEnv('FIREBASE_AUTH_DOMAIN'),
      projectId: getSafeEnv('FIREBASE_PROJECT_ID'),
      storageBucket: getSafeEnv('FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getSafeEnv('FIREBASE_MESSAGING_SENDER_ID'),
      appId: getSafeEnv('FIREBASE_APP_ID'),
    };
  }
  
  // 2. このエディタ(Canvas)内での実行用フォールバック
  try {
    if (typeof __firebase_config !== 'undefined') {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Firebase config parsing error", e);
  }

  return null;
};

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// App IDの取得
const APP_ID = getSafeEnv('APP_ID') || (typeof __app_id !== 'undefined' ? __app_id : 'lyric-note-production');

const App = () => {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentSongId, setCurrentSongId] = useState(() => localStorage.getItem('lyric-note-current-id') || null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);

  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // 設定エラーのチェック
  if (!app || !db || !auth) {
    return (
      <div className="h-screen bg-slate-900 text-white flex items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Configuration Error</h1>
          <p className="text-slate-400">Firebaseの設定が見つかりません。環境変数を確認してください。</p>
        </div>
      </div>
    );
  }

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetch
  useEffect(() => {
    if (!user) return;

    const q = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedSongs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }));

      loadedSongs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setSongs(loadedSongs);
      setIsLoading(false);

      if (loadedSongs.length > 0 && !currentSongId) {
        setCurrentSongId(loadedSongs[0].id);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentSongId]);

  useEffect(() => {
    if (currentSongId) {
      localStorage.setItem('lyric-note-current-id', currentSongId);
    }
  }, [currentSongId]);

  const activeSong = songs.find(s => s.id === currentSongId) || { 
    title: '', content: '', memos: '', bpm: 120, updatedAt: new Date().toISOString() 
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const debouncedSave = useCallback((songId, data) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !songId) return;
      try {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', songId);
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error');
      }
    }, 800);
  }, [user]);

  const createNewSong = async () => {
    if (!user) return;
    try {
      const newSongData = { title: 'New Track', content: '', memos: '', bpm: 120, updatedAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs'), newSongData);
      setCurrentSongId(docRef.id);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      showNotification("新規トラックを作成しました");
    } catch (error) {
      showNotification("作成に失敗しました");
    }
  };

  const deleteSong = async (id, e) => {
    e.stopPropagation();
    if (songs.length <= 1) {
      showNotification("最後の1曲は削除できません");
      return;
    }
    if (confirm('このトラックを削除しますか？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', id));
        showNotification("削除しました");
      } catch (error) {
        showNotification("削除に失敗しました");
      }
    }
  };

  const updateSong = (field, value) => {
    if (!currentSongId) return;
    setSongs(prevSongs => prevSongs.map(song => 
      song.id === currentSongId ? { ...song, [field]: value } : song
    ));
    const currentSongData = songs.find(s => s.id === currentSongId);
    if (currentSongData) {
      const updatedData = { ...currentSongData, [field]: value };
      delete updatedData.id; 
      delete updatedData.updatedAt;
      debouncedSave(currentSongId, updatedData);
    }
  };

  const insertTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeSong.content || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const prefix = (start > 0 && text[start - 1] !== '\n') ? '\n\n' : '';
    const suffix = '\n';
    const newContent = `${before}${prefix}[${tag}]${suffix}${after}`;
    updateSong('content', newContent);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + tag.length + 2 + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const copyToClipboard = () => {
    const text = `Title: ${activeSong.title}\nBPM: ${activeSong.bpm}\n\n${activeSong.content}`;
    // Navigator APIのフォールバック
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showNotification("コピーしました");
      });
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showNotification("コピーしました");
    }
  };

  const structureTags = ['Intro', 'Verse', 'Hook', 'Chorus', 'Bridge', 'Pre-Chorus', 'Outro'];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed md:relative z-30 w-72 h-full bg-slate-800 border-r border-slate-700 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'} ${!isSidebarOpen && 'md:w-0 md:overflow-hidden md:border-none'}`}>
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-400"><Music className="w-6 h-6" /><span>Lyric Note</span></div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <button onClick={createNewSong} disabled={!user} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white py-3 rounded-lg transition-colors font-medium shadow-lg"><Plus className="w-5 h-5" />New Track</button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {isLoading ? <div className="text-center py-10 text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Loading...</div> :
            songs.map(song => (
              <div key={song.id} onClick={() => { setCurrentSongId(song.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent ${currentSongId === song.id ? 'bg-slate-700 border-slate-600' : 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'}`}>
                <div className="flex-1 min-w-0"><h3 className="font-medium truncate">{song.title || 'No Title'}</h3><p className="text-xs opacity-60 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formatDate(song.updatedAt)}</p></div>
                <button onClick={(e) => deleteSong(song.id, e)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))
          }
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-900">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 bg-slate-900/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><Menu className="w-5 h-5" /></button>}
            <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <Edit3 className="w-5 h-5 text-slate-500 shrink-0" />
              <input type="text" value={activeSong.title || ''} onChange={(e) => updateSong('title', e.target.value)} placeholder="Track Title..." className="bg-transparent text-xl md:text-2xl font-bold text-white placeholder-slate-700 focus:outline-none w-full truncate border-b border-transparent focus:border-indigo-500/50 transition-colors" />
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 ml-4">
            <div className="text-xs font-medium">
              {saveStatus === 'saving' ? <span className="text-indigo-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</span> :
               saveStatus === 'saved' ? <span className="text-emerald-500 flex items-center gap-1 opacity-70"><Cloud className="w-3 h-3" /> Cloud Saved</span> : null}
            </div>
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-700"><span className="text-xs text-slate-400 mr-2 font-bold">BPM</span><input type="number" value={activeSong.bpm || ''} onChange={(e) => updateSong('bpm', e.target.value)} className="w-12 bg-transparent text-sm text-center focus:outline-none font-mono text-indigo-300" /></div>
            <button onClick={copyToClipboard} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg"><Copy className="w-5 h-5" /></button>
            <button onClick={() => setShowMemos(!showMemos)} className={`p-2 rounded-lg hidden md:block ${showMemos ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}><Lightbulb className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col relative min-w-0">
            <div className="h-12 border-b border-slate-800 flex items-center px-4 gap-2 overflow-x-auto bg-slate-900/95">
              <PenTool className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              {structureTags.map(tag => (
                <button key={tag} onClick={() => insertTag(tag)} className="px-3 py-1 bg-slate-800 hover:bg-indigo-900/30 hover:text-indigo-300 text-slate-300 text-xs rounded-full border border-slate-700 transition-all whitespace-nowrap">{tag}</button>
              ))}
            </div>
            <textarea ref={textareaRef} value={activeSong.content || ''} onChange={(e) => updateSong('content', e.target.value)} placeholder="ここに歌詞を入力してください..." className="flex-1 w-full p-4 md:p-8 bg-transparent resize-none focus:outline-none text-lg leading-relaxed text-slate-200 font-medium placeholder-slate-700" spellCheck="false" />
          </div>
          {showMemos && (
            <div className="w-80 border-l border-slate-800 bg-slate-950/30 flex flex-col hidden md:flex">
              <div className="p-3 border-b border-slate-800 flex items-center gap-2 text-sm font-semibold text-slate-400 bg-slate-900/50"><Lightbulb className="w-4 h-4 text-yellow-500" /><span>Ideas / Memo</span></div>
              <textarea value={activeSong.memos || ''} onChange={(e) => updateSong('memos', e.target.value)} placeholder="メモを入力..." className="flex-1 w-full p-4 bg-transparent resize-none focus:outline-none text-sm text-slate-400" />
            </div>
          )}
        </div>

        <button className="md:hidden fixed bottom-6 right-6 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-20" onClick={() => setShowMemos(!showMemos)}>{showMemos ? <FileText className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}</button>
        {showMemos && (
          <div className="md:hidden fixed inset-0 z-10 bg-slate-900 flex flex-col pt-16 pb-20 px-4">
             <div className="flex items-center justify-between mb-4 text-indigo-400"><span className="font-bold flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Ideas</span><button onClick={() => setShowMemos(false)} className="p-2 bg-slate-800 rounded-full"><X className="w-4 h-4"/></button></div>
             <textarea value={activeSong.memos || ''} onChange={(e) => updateSong('memos', e.target.value)} placeholder="メモを入力..." className="flex-1 w-full p-4 bg-slate-800 rounded-xl resize-none focus:outline-none text-base text-slate-200" />
          </div>
        )}
      </main>

      {notification && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full shadow-lg text-sm font-medium animate-fade-in-up z-50 flex items-center gap-2"><Check className="w-4 h-4" />{notification}</div>}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in-up { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;