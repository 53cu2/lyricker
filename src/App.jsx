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
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);
  
  const typingTimerRef = useRef(null);
  const contentRef = useRef(null);
  const chatEndRef = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
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
    
    setChatMessages([
      {
        id: 1,
        user: 'System',
        message: 'Welcome to Lyric Note! Start collaborating.',
        timestamp: new Date()
      }
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

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

  const containerStyle = {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#020617',
    color: '#f1f5f9',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const sidebarStyle = {
    width: sidebarOpen ? '320px' : '0',
    transition: 'width 0.3s',
    backgroundColor: '#0f172a',
    borderRight: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const buttonPrimary = {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const buttonSecondary = {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer'
  };

  const inputStyle = {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    outline: 'none',
    width: '100%'
  };

  const textareaStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '2.5rem',
    fontWeight: 'bold',
    lineHeight: '1.6',
    outline: 'none',
    resize: 'none',
    border: 'none',
    color: '#f1f5f9'
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Music style={{ color: '#818cf8' }} size={28} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Lyric Note</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={buttonSecondary}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={createNewSession} style={buttonPrimary}>
            <Plus size={20} />
            New Session
          </button>
          
          <button
            onClick={() => setShowFirebaseGuide(true)}
            style={{ ...buttonSecondary, width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            🔥 Firebase Setup
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
            Sessions
          </h2>
          {songs.map(song => (
            <button
              key={song.id}
              onClick={() => selectSong(song)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '0.5rem',
                backgroundColor: currentSong?.id === song.id ? '#4f46e5' : '#1e293b',
                color: currentSong?.id === song.id ? 'white' : '#cbd5e1',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.title}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>
                {new Date(song.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} style={buttonSecondary}>
                <Menu size={20} />
              </button>
            )}
            
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={handleTitleSave}
                  style={{ ...inputStyle, fontSize: '1.5rem', fontWeight: 'bold', width: '400px' }}
                  placeholder="Untitled"
                />
                <button onClick={handleTitleSave} style={buttonPrimary}>
                  <Save size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{title}</h2>
                <button onClick={() => setIsEditingTitle(true)} style={buttonSecondary}>
                  <Edit2 size={18} />
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '0.5rem 1rem' }}>
              <Music size={16} style={{ color: '#818cf8' }} />
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                style={{ backgroundColor: 'transparent', width: '64px', textAlign: 'center', outline: 'none', border: 'none', color: '#f1f5f9' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>BPM</span>
            </div>
            
            <button onClick={() => setChatOpen(!chatOpen)} style={{ ...buttonSecondary, position: 'relative' }}>
              <MessageCircle size={20} />
              {chatMessages.length > 1 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#4f46e5',
                  fontSize: '0.75rem',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {chatMessages.length}
                </span>
              )}
            </button>
            
            <button onClick={handleShare} style={buttonPrimary}>
              {copied ? <Check size={18} /> : <Share2 size={18} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Structure Tags */}
        <div style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => insertTag(tag)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1e293b',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                color: '#cbd5e1'
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Editor Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main Editor */}
          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <textarea
              ref={contentRef}
              value={content}
              onChange={handleContentChange}
              style={textareaStyle}
              placeholder="Start writing your lyrics..."
              spellCheck={false}
            />
          </div>

          {/* Ideas Panel */}
          <div style={{ width: '384px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', padding: '1.5rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '1rem' }}>
              Ideas & Rhymes
            </h3>
            <textarea
              value={memos}
              onChange={(e) => setMemos(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#1e293b',
                borderRadius: '0.5rem',
                padding: '1rem',
                outline: 'none',
                resize: 'none',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                border: 'none',
                color: '#f1f5f9'
              }}
              placeholder="Keep your rhyme ideas, flows, and notes here..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div style={{ backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>{content.split('\n').length} lines</span>
            <span>{content.split(/\s+/).filter(w => w).length} words</span>
            <span style={{ color: '#818cf8' }}>as {userName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isTyping ? (
              <span style={{ color: '#fbbf24' }}>Typing...</span>
            ) : (
              <span style={{ color: '#4ade80' }}>Saved</span>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div style={{ width: '384px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontWeight: '600' }}>Team Chat</h3>
            <button onClick={() => setChatOpen(false)} style={buttonSecondary}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ marginBottom: '0.75rem', textAlign: msg.user === 'System' ? 'center' : 'left' }}>
                <div style={msg.user === 'System' ? 
                  { backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '9999px', display: 'inline-block' } :
                  { backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '0.75rem' }
                }>
                  {msg.user !== 'System' && (
                    <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {msg.user}
                    </div>
                  )}
                  <div style={{ fontSize: msg.user === 'System' ? '0.75rem' : '0.875rem' }}>
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div style={{ padding: '1rem', borderTop: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Type a message..."
                style={inputStyle}
              />
              <button onClick={sendMessage} style={buttonPrimary}>
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#1e293b',
            padding: '0.5rem',
            borderTopRightRadius: '0.5rem',
            borderBottomRightRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            zIndex: 50
          }}
        >
          <ChevronRight size={20} style={{ color: '#cbd5e1' }} />
        </button>
      )}

      {/* Firebase Guide Modal */}
      {showFirebaseGuide && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '1rem',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>🔥 Firebase Setup Guide</h2>
              <button onClick={() => setShowFirebaseGuide(false)} style={buttonSecondary}>
                <X size={24} />
              </button>
            </div>

            <div style={{ color: '#cbd5e1' }}>
              <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#818cf8', marginBottom: '1rem' }}>
                  ステップ 1: Firebaseプロジェクト作成
                </h3>
                <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                  <li>Firebase Consoleにアクセス (console.firebase.google.com)</li>
                  <li>「プロジェクトを追加」をクリック</li>
                  <li>プロジェクト名を入力（例: lyric-note-app）</li>
                  <li>Google アナリティクスは任意で設定</li>
                </ol>
              </div>

              <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#818cf8', marginBottom: '1rem' }}>
                  ステップ 2: Firestore Database 有効化
                </h3>
                <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                  <li>左メニューから「Firestore Database」を選択</li>
                  <li>「データベースの作成」をクリック</li>
                  <li>「本番環境モード」を選択</li>
                  <li>ロケーションを選択（asia-northeast1推奨）</li>
                </ol>
              </div>

              <div style={{ backgroundColor: '#4f46e5', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>💡 実装のポイント</h3>
                <ul style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                  <li>デバウンス処理でタイピング中の保存をスキップ</li>
                  <li>楽観的更新でローカル変更を即座に反映</li>
                  <li>onSnapshotでリアルタイム監視を実装</li>
                  <li>チャット機能はサブコレクションで管理</li>
                </ul>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFirebaseGuide(false)} style={{ ...buttonPrimary, padding: '0.75rem 1.5rem' }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricNote;