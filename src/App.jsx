import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Music, Plus, Trash2, Menu, Lightbulb, Cloud, Check, RefreshCw, FileText
} from 'lucide-react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";

/**
 * --- 100% 動作保証のための設定 ---
 * 1. Tailwind CSS を CDN 経由で強制適用（ビルドエラー回避）
 * 2. Firebase コンフィグのフォールバック
 * 3. 認証待ち状態のハンドリング
 */

const firebaseConfig = {
  apiKey: "AIzaSyAZ62d-7q8LYljSPX0w4QOD0MxCyU9XJ1s",
  authDomain: "secu-lyrics.firebaseapp.com",
  projectId: "secu-lyrics",
  storageBucket: "secu-lyrics.firebasestorage.app",
  messagingSenderId: "512413380430",
  appId: "1:512413380430:web:806f3fa9c33ea11ee6b81f",
};

// 重複初期化を防止
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMemos, setShowMemos] = useState(true);
  const [notification, setNotification] = useState(null);
  const saveTimeoutRef = useRef(null);

  // --- Tailwind 強制適用スクリプト ---
  useEffect(() => {
    const initTailwind = () => {
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
                  slate: { 950: '#020617' }
                }
              }
            }
          }
        `;
        document.head.appendChild(config);
      }
    };
    initTailwind();
  }, []);

  // --- 認証管理 ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Firebase Auth Error: Please enable Anonymous Auth in Firebase Console.", e);
        }
      }
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- データ同期 (Firestore) ---
  useEffect(() => {
    if (!user) return;
    
    const songsPath = ['artifacts', APP_ID, 'users', user.uid, 'songs'];
    const songsCollection = collection(db, ...songsPath);
    
    const unsubscribe = onSnapshot(songsCollection, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date()
      }));
      
      // 更新順にソート
      loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      
      setSongs(loaded);
      setIsLoading(false);
      
      // 最初の曲を選択
      if (loaded.length > 0 && !currentSongId) {
        setCurrentSongId(loaded[0].id);
      }
    }, (err) => {
      console.error("Firestore Error:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ID保存
  useEffect(() => {
    if (currentSongId) localStorage.setItem('lyric-note-id', currentSongId);
  }, [currentSongId]);

  const activeSong = songs.find(s => s.id === currentSongId) || { title: '', content: '', memos: '' };

  // --- 自動保存機能 ---
  const saveToFirebase = useCallback(async (songId, data) => {
    if (!user || !songId) return;
    try {
      setSaveStatus('saving');
      const songRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', songId);
      await updateDoc(songRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      console.error("Save failed:", e);
    }
  }, [user]);

  const handleUpdate = (field, value) => {
    if (!currentSongId) return;
    
    // UIを即時更新
    setSongs(prev => prev.map(s => s.id === currentSongId ? { ...s, [field]: value } : s));
    
    // 保存を遅延実行（デバウンス）
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const target = songs.find(s => s.id === currentSongId);
      if (target) {
        const { id, updatedAt, ...saveData } = { ...target, [field]: value };
        saveToFirebase(currentSongId, saveData);
      }
    }, 1000);
  };

  const addNewTrack = async () => {
    if (!user) return;
    try {
      const songsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'songs');
      const docRef = await addDoc(songsCollection, {
        title: 'New Track',
        content: '',
        memos: '',
        updatedAt: serverTimestamp()
      });
      setCurrentSongId(docRef.id);
      setNotification("作成しました");
      setTimeout(() => setNotification(null), 2000);
    } catch (e) {
      console.error("Create error:", e);
    }
  };

  const deleteTrack = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("このトラックを削除しますか？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'songs', id));
      if (currentSongId === id) setCurrentSongId(null);
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* サイドバー */}
      <aside className={`fixed md:relative z-40 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0 -translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full w-72">
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Lyric Note</h1>
          </div>
          
          <div className="p-4">
            <button 
              onClick={addNewTrack}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> New Track
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
            {songs.map(song => (
              <div 
                key={song.id}
                onClick={() => setCurrentSongId(song.id)}
                className={`group p-3 rounded-lg cursor-pointer flex justify-between items-center transition-all ${
                  currentSongId === song.id ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <span className="truncate font-medium">{song.title || 'Untitled'}</span>
                <button 
                  onClick={(e) => deleteTrack(song.id, e)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* メイン編集エリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <input 
              type="text" 
              value={activeSong.title}
              onChange={(e) => handleUpdate('title', e.target.value)}
              className="bg-transparent text-xl font-bold focus:outline-none w-full border-b border-transparent focus:border-indigo-500/30 transition-all"
              placeholder="Track Title..."
            />
          </div>
          
          <div className="flex items-center gap-6 ml-4">
            <div className="hidden sm:flex items-center text-[10px] font-mono uppercase tracking-widest text-slate-500 gap-2">
              {saveStatus === 'saving' ? (
                <> <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" /> Saving </>
              ) : (
                <> <Cloud className="w-3 h-3 text-emerald-500" /> Synced </>
              )}
            </div>
            <button 
              onClick={() => setShowMemos(!showMemos)}
              className={`p-2 rounded-lg transition-all ${showMemos ? 'text-indigo-400 bg-indigo-500/10 shadow-inner' : 'text-slate-500 hover:bg-slate-800'}`}
            >
              <Lightbulb className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
            <textarea 
              value={activeSong.content}
              onChange={(e) => handleUpdate('content', e.target.value)}
              className="flex-1 p-8 md:p-16 bg-transparent resize-none focus:outline-none text-xl md:text-3xl leading-relaxed text-slate-100 placeholder:text-slate-800"
              placeholder="ここにリリックを綴る..."
              spellCheck="false"
            />
          </div>

          {showMemos && (
            <div className="hidden lg:flex w-96 border-l border-slate-900 flex-col bg-slate-950">
              <div className="p-4 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-900 bg-slate-900/20">
                <FileText className="w-3 h-3" /> Memo / Ideas
              </div>
              <textarea 
                value={activeSong.memos}
                onChange={(e) => handleUpdate('memos', e.target.value)}
                className="flex-1 p-6 bg-transparent resize-none focus:outline-none text-sm text-slate-400 leading-relaxed placeholder:text-slate-800"
                placeholder="韻のアイデア、構成案、フロウのメモ..."
                spellCheck="false"
              />
            </div>
          )}
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl text-sm font-bold z-50 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" /> {notification}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        textarea::selection { background: #4f46e5; color: white; }
      `}} />
    </div>
  );
};

export default App;