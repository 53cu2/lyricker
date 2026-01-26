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
 * --- 環境変数の取得 ---
 * "import.meta" のエラーを回避するため、より安全な参照方法に変更しました。
 */
const getEnv = (key) => {
  try {
    // 1. 標準的な process.env (Vercel/Node)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    
    // 2. Vite (import.meta) - 直接的な参照を避け、エラーを防止
    const metaEnv = (new Function("return typeof import.meta !== 'undefined' ? import.meta.env : undefined"))();
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
    }
  } catch (e) {
    // 参照エラー時はスキップ
  }
  return undefined;
};

const getFirebaseConfig = () => {
  // 環境変数から優先的に読み込む
  const config = {
    apiKey: getEnv('FIREBASE_API_KEY'),
    authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('FIREBASE_APP_ID'),
  };

  // Vercel/環境変数が未設定の場合、Canvas環境のグローバル変数を使用
  if (!config.apiKey) {
    try {
      if (typeof __firebase_config !== 'undefined') {
        const localConfig = JSON.parse(__firebase_config);
        return localConfig;
      }
    } catch (e) {}
  }
  return config.apiKey ? config : null;
};

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const APP_ID = getEnv('APP_ID') || (typeof __app_id !== 'undefined' ? __app_id : 'lyric-note-production');

const App = () => {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentSongId, setCurrentSongId] = useState(() => {
    try {
      return localStorage.getItem('lyric-note-current-id') || null;
    } catch (e) {
      return null;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // 初期化エラーの表示
  if (!app || !db || !auth) {
    return (
      <div className="h-screen bg-slate-900 text-white flex items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Configuration Required</h1>
          <p className="text-slate-400 mb-6">
            Firebaseの設定が見つかりません。VercelのEnvironment Variables、またはCanvasの設定を確認してください。
          </p>
          <div className="bg-slate-800 p-4 rounded-lg text-left text-xs font-mono text-slate-300">
            必要なキー: FIREBASE_API_KEY, FIREBASE_PROJECT_ID ...
          </div>
        </div>
      </div>
    );
  }

  // 認証
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth initialization failed", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // データ同期
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      loaded.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setSongs(loaded);
      setIsLoading(false);
      if (loaded.length > 0 && !currentSongId) setCurrentSongId(loaded[0].id);
    }, (err) => {
      console.error("Firestore listening failed", err);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, currentSongId]);

  useEffect(() => {
    if (currentSongId) {
      try {
        localStorage.setItem('lyric-note-current-id', currentSongId);
      } catch (e) {}
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
      } catch (e) {
        setSaveStatus('error');
      }
    }, 800);
  }, [user]);

  const updateSong = (field, value) => {
    if (!currentSongId) return;
    setSongs(prev => prev.map(s => s.id === currentSongId ? { ...s, [field]: value } : s));
    const song = songs.find(s => s.id === currentSongId);
    if (song) {
      const updated = { ...song, [field]: value };
      delete updated.id;
      delete updated.updatedAt;
      debouncedSave(currentSongId, updated);
    }
  };

  const createNewSong = async () => {
    if (!user) return;
    try {
      const res = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs'), { 
        title: 'New Track', content: '', memos: '', bpm: 120, updatedAt: serverTimestamp() 
      });
      setCurrentSongId(res.id);
      setNotification("新しいトラックを作成しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) {
      console.error("Create failed", e);
    }
  };

  const deleteTrack = async (id, e) => {
    e.stopPropagation();
    if (!confirm("このトラックを削除しますか？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', id));
      setNotification("削除しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
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
          {isLoading ? (
            <div className="p-4 text-center text-slate-500"><RefreshCw className="animate-spin inline-block mr-2" />Loading...</div>
          ) : (
            songs.map(s => (
              <div key={s.id} onClick={() => setCurrentSongId(s.id)} className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${currentSongId === s.id ? 'bg-slate-700' : 'hover:bg-slate-700/50 text-slate-400'}`}>
                <div className="font-medium truncate flex-1">{s.title || 'No Title'}</div>
                <button onClick={(e) => deleteTrack(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-900 min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
            <input type="text" value={activeSong.title} onChange={(e) => updateSong('title', e.target.value)} className="bg-transparent text-xl font-bold focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 transition-all" placeholder="Untitled Track" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-500">
              {saveStatus === 'saving' ? <span className="text-indigo-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> saving</span> : 
               saveStatus === 'saved' ? <span className="text-emerald-500 flex items-center gap-1"><Cloud className="w-3 h-3" /> synced</span> : null}
            </div>
            <button onClick={() => setShowMemos(!showMemos)} className={`p-2 rounded-lg transition-colors ${showMemos ? 'bg-slate-800 text-yellow-500' : 'text-slate-400 hover:bg-slate-800'}`}><Lightbulb className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
            <textarea ref={textareaRef} value={activeSong.content} onChange={(e) => updateSong('content', e.target.value)} className="flex-1 p-8 md:p-12 bg-transparent resize-none focus:outline-none text-lg md:text-xl leading-relaxed text-slate-200" placeholder="歌詞をここに書き留めてください..." spellCheck="false" />
          </div>
          {showMemos && (
            <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-950/20">
              <div className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 flex items-center gap-2"><FileText className="w-4 h-4" /> Memo / Ideas</div>
              <textarea value={activeSong.memos} onChange={(e) => updateSong('memos', e.target.value)} className="flex-1 p-4 bg-transparent resize-none focus:outline-none text-sm text-slate-400 leading-relaxed" placeholder="ライムの候補やメロディの着想など..." />
            </div>
          )}
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full shadow-2xl text-sm font-medium z-50 animate-bounce">
          <Check className="inline-block mr-2 w-4 h-4" />{notification}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
};

export default App;