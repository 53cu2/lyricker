import React, { useState, useEffect, useRef } from 'react';
import { Music, Share2, Plus, Menu, X, ChevronRight, Copy, Check, MessageCircle, Send, Edit2, Save } from 'lucide-react';

const LyricNote = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [content, setContent] = useState('');
  const [memos, setMemos] = useState('');
  const [bpm, setBpm] = useState(120);
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [userName, setUserName] = useState('');
  
  // Firebase setup guide
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);
  
  const typingTimerRef = useRef(null);
  const contentRef = useRef(null);
  const chatEndRef = useRef(null);
  const titleInputRef = useRef(null);

  // Initialize with demo data
  useEffect(() => {
    // Generate random user name for demo
    const names = ['Artist', 'Producer', 'Writer', 'MC', 'Singer'];
    setUserName(names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100));
    
    const demoSongs = [
      {
        id: 'demo1',
        title: 'Untitled Session',
        content: '',
        memos: '',
        bpm: 120,
        updatedAt: new Date()
      }
    ];
    setSongs(demoSongs);
    setCurrentSong(demoSongs[0]);
    setTitle(demoSongs[0].title);
    
    // Demo chat messages
    setChatMessages([
      {
        id: 1,
        user: 'System',
        message: 'Welcome to Lyric Note! Start collaborating.',
        timestamp: new Date()
      }
    ]);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Simulate real-time sync
  useEffect(() => {
    if (!currentSong) return;
    
    if (!isTyping) {
      const updatedSong = {
        ...currentSong,
        title,
        content,
        memos,
        bpm,
        updatedAt: new Date()
      };
      
      setSongs(prev => prev.map(s => s.id === currentSong.id ? updatedSong : s));
    }
  }, [title, content, memos, bpm, isTyping, currentSong]);

  const handleContentChange = (e) => {
    setContent(e.target.value);
    setIsTyping(true);
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const createNewSession = () => {
    const newSong = {
      id: `song_${Date.now()}`,
      title: 'New Session',
      content: '',
      memos: '',
      bpm: 120,
      updatedAt: new Date()
    };
    
    setSongs(prev => [newSong, ...prev]);
    setCurrentSong(newSong);
    setTitle(newSong.title);
    setContent('');
    setMemos('');
    setBpm(120);
  };

  const selectSong = (song) => {
    setCurrentSong(song);
    setTitle(song.title);
    setContent(song.content);
    setMemos(song.memos);
    setBpm(song.bpm);
  };

  const insertTag = (tag) => {
    const newContent = content + `\n\n[${tag}]\n`;
    setContent(newContent);
  };

  const handleShare = () => {
    const url = `${window.location.origin}?session=${currentSong?.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (currentSong) {
      const updatedSong = { ...currentSong, title, updatedAt: new Date() };
      setSongs(prev => prev.map(s => s.id === currentSong.id ? updatedSong : s));
    }
  };

  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitle(currentSong?.title || '');
      setIsEditingTitle(false);
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      user: userName,
      message: chatInput,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const tags = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro', 'Hook'];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="text-indigo-400" size={28} />
            <h1 className="text-xl font-bold">Lyric Note</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <button
            onClick={createNewSession}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors"
          >
            <Plus size={20} />
            New Session
          </button>
          
          <button
            onClick={() => setShowFirebaseGuide(true)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-colors"
          >
            🔥 Firebase Setup
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs uppercase text-slate-400 font-semibold mb-3 px-2">Sessions</h2>
          {songs.map(song => (
            <button
              key={song.id}
              onClick={() => selectSong(song)}
              className={`w-full text-left p-4 rounded-lg transition-colors ${
                currentSong?.id === song.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
              }`}
            >
              <div className="font-semibold truncate">{song.title}</div>
              <div className="text-xs opacity-70 mt-1">
                {new Date(song.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
            
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={handleTitleSave}
                  className="bg-slate-800 text-2xl font-bold px-3 py-1 rounded outline-none focus:ring-2 focus:ring-indigo-500 w-96"
                  placeholder="Untitled"
                />
                <button
                  onClick={handleTitleSave}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  <Save size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <h2 className="text-2xl font-bold">{title}</h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-slate-800 rounded-lg transition-all"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-2">
              <Music size={16} className="text-indigo-400" />
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                className="bg-transparent w-16 text-center outline-none"
              />
              <span className="text-xs text-slate-400">BPM</span>
            </div>
            
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="relative p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <MessageCircle size={20} />
              {chatMessages.length > 1 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {chatMessages.length}
                </span>
              )}
            </button>
            
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              {copied ? <Check size={18} /> : <Share2 size={18} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Structure Tags */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex gap-2 overflow-x-auto">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => insertTag(tag)}
              className="px-4 py-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Editor */}
          <div className="flex-1 p-8 overflow-y-auto">
            <textarea
              ref={contentRef}
              value={content}
              onChange={handleContentChange}
              className="w-full h-full bg-transparent text-4xl font-bold leading-relaxed outline-none resize-none placeholder-slate-700"
              placeholder="Start writing your lyrics..."
              spellCheck={false}
            />
          </div>

          {/* Ideas Panel */}
          <div className="w-96 bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto">
            <h3 className="text-sm uppercase text-slate-400 font-semibold mb-4">Ideas & Rhymes</h3>
            <textarea
              value={memos}
              onChange={(e) => setMemos(e.target.value)}
              className="w-full h-full bg-slate-800 rounded-lg p-4 outline-none resize-none text-sm leading-relaxed"
              placeholder="Keep your rhyme ideas, flows, and notes here..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>{content.split('\n').length} lines</span>
            <span>{content.split(/\s+/).filter(w => w).length} words</span>
            <span className="text-indigo-400">as {userName}</span>
          </div>
          <div className="flex items-center gap-2">
            {isTyping ? (
              <span className="text-yellow-400">Typing...</span>
            ) : (
              <span className="text-green-400">Saved</span>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold">Team Chat</h3>
            <button onClick={() => setChatOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`${msg.user === 'System' ? 'text-center' : ''}`}>
                <div className={`${msg.user === 'System' ? 'bg-slate-800 text-slate-400 text-xs py-2 px-3 rounded-full inline-block' : 'bg-slate-800 rounded-lg p-3'}`}>
                  {msg.user !== 'System' && (
                    <div className="text-xs text-indigo-400 font-semibold mb-1">{msg.user}</div>
                  )}
                  <div className={msg.user === 'System' ? '' : 'text-sm'}>{msg.message}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-4 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={sendMessage}
                className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded-lg transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Toggle (when closed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-700 p-2 rounded-r-lg transition-colors z-50"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Firebase Setup Guide Modal */}
      {showFirebaseGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-8">
          <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">🔥 Firebase Setup Guide</h2>
                <button
                  onClick={() => setShowFirebaseGuide(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 text-slate-300">
                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4">ステップ 1: Firebaseプロジェクト作成</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li><a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Firebase Console</a> にアクセス</li>
                    <li>「プロジェクトを追加」をクリック</li>
                    <li>プロジェクト名を入力（例: lyric-note-app）</li>
                    <li>Google アナリティクスは任意で設定</li>
                  </ol>
                </div>

                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4">ステップ 2: Webアプリ登録</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>プロジェクトダッシュボードで「&lt;/&gt;」アイコンをクリック</li>
                    <li>アプリのニックネームを入力</li>
                    <li>「アプリを登録」をクリック</li>
                    <li>表示される設定情報（API キーなど）をコピー</li>
                  </ol>
                </div>

                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4">ステップ 3: Firestore Database 有効化</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>左メニューから「Firestore Database」を選択</li>
                    <li>「データベースの作成」をクリック</li>
                    <li>「本番環境モード」を選択（後でルールを設定）</li>
                    <li>ロケーションを選択（asia-northeast1推奨）</li>
                  </ol>
                </div>

                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4">ステップ 4: セキュリティルール設定</h3>
                  <p className="mb-3">Firestoreの「ルール」タブで以下を設定:</p>
                  <pre className="bg-slate-950 p-4 rounded text-sm overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/songs/{songId} {
      allow read, write: if true; // 開発中は誰でもアクセス可能
    }
  }
}`}
                  </pre>
                  <p className="text-yellow-400 text-sm mt-3">⚠️ 本番環境では認証を追加してください</p>
                </div>

                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4">ステップ 5: コードに統合</h3>
                  <p className="mb-3">1. Firebase SDKをインストール（ローカル開発の場合）:</p>
                  <pre className="bg-slate-950 p-4 rounded text-sm mb-4">
{`npm install firebase`}
                  </pre>
                  
                  <p className="mb-3">2. Firebaseの設定を追加（コンポーネント上部に）:</p>
                  <pre className="bg-slate-950 p-4 rounded text-sm overflow-x-auto">
{`import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, 
         setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);`}
                  </pre>

                  <p className="mb-3 mt-4">3. データ保存の例:</p>
                  <pre className="bg-slate-950 p-4 rounded text-sm overflow-x-auto">
{`// セッション保存
const saveSong = async (songId, data) => {
  const songRef = doc(db, \`artifacts/lyric-note/public/data/songs/\${songId}\`);
  await setDoc(songRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// リアルタイム監視
const songRef = doc(db, \`artifacts/lyric-note/public/data/songs/\${songId}\`);
onSnapshot(songRef, (snapshot) => {
  const data = snapshot.data();
  if (data && !isTyping) {
    setTitle(data.title);
    setContent(data.content);
    // ...
  }
});`}
                  </pre>
                </div>

                <div className="bg-indigo-600 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-3">💡 重要なポイント</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>デバウンス処理</strong>: 入力中は保存をスキップ（isTyping フラグ使用）</li>
                    <li><strong>楽観的更新</strong>: ローカル変更を即座に反映し、バックグラウンドで同期</li>
                    <li><strong>コンフリクト対策</strong>: 最終書き込み優先（LWW）またはタイムスタンプ比較</li>
                    <li><strong>チャット機能</strong>: サブコレクション /songs/{songId}/messages で実装</li>
                  </ul>
                </div>

                <div className="bg-slate-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-green-400 mb-3">✅ 完了後の確認</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>複数のブラウザタブで開いてリアルタイム同期をテスト</li>
                    <li>Firebase Consoleでデータが正しく保存されているか確認</li>
                    <li>ネットワークを切断してもローカルで編集できるか確認</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowFirebaseGuide(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricNote;