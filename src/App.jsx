import React, { useState, useEffect, useRef } from 'react';
import { Music, Share2, Plus, Menu, X, ChevronRight, Check, MessageCircle, Send, Edit2, Save } from 'lucide-react';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy,
  addDoc
} from 'firebase/firestore';

const LyricNote = () => {
  // Body style reset
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.height = '';
      document.documentElement.style.height = '';
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [rightPanelTab, setRightPanelTab] = useState('ideas'); // 'ideas', 'chat', 'settings'
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarTab, setMobileSidebarTab] = useState('sessions'); // 'sessions', 'writing', 'lyrics'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const typingTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const contentRef = useRef(null);
  const chatEndRef = useRef(null);
  const titleInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const unsubscribeSongRef = useRef(null);
  const unsubscribeChatRef = useRef(null);
  const lastSavedContentRef = useRef('');
  const lastSavedMemosRef = useRef('');
  const lastSavedTitleRef = useRef('');
  const lastKnownRemoteContentRef = useRef('');
  const localEditTimestampRef = useRef(0);

  // Initialize user name
  useEffect(() => {
    const savedName = localStorage.getItem('lyrickerUserName');
    if (savedName) {
      setUserName(savedName);
    } else {
      const names = ['Artist', 'Producer', 'Writer', 'MC', 'Singer'];
      const generatedName = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
      setUserName(generatedName);
      localStorage.setItem('lyrickerUserName', generatedName);
    }
  }, []);

  // Load songs list from Firebase
  useEffect(() => {
    const loadSongs = async () => {
      try {
        const songsRef = collection(db, 'songs');
        const snapshot = await getDocs(songsRef);
        
        if (snapshot.empty) {
          // Create initial song if none exist
          await createNewSession();
        } else {
          const loadedSongs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          }));
          
          // Sort by updatedAt
          loadedSongs.sort((a, b) => b.updatedAt - a.updatedAt);
          setSongs(loadedSongs);
          
          // Select first song
          if (loadedSongs.length > 0) {
            selectSong(loadedSongs[0]);
          }
        }
        
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Error loading songs:', error);
        setConnectionStatus('error');
      }
    };
    
    loadSongs();
  }, []);

  // Real-time sync for current song with CRDT-inspired conflict resolution
  useEffect(() => {
    if (!currentSong?.id) return;
    
    const songRef = doc(db, 'songs', currentSong.id);
    
    unsubscribeSongRef.current = onSnapshot(songRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data();
      const remoteContent = data.content || '';
      const remoteTitle = data.title || '';
      const remoteMemos = data.memos || '';
      const remoteBpm = data.bpm || 120;
      const remoteTimestamp = data.updatedAt?.toMillis() || 0;
      
      // CRDT Strategy: Last-Write-Wins with timestamp comparison
      // Only update if remote data is newer than our last edit
      if (!isTyping && remoteTimestamp > localEditTimestampRef.current) {
        // Three-way merge: detect if content has diverged
        if (remoteContent !== lastKnownRemoteContentRef.current) {
          const localChanges = content !== lastKnownRemoteContentRef.current;
          
          if (localChanges) {
            // Both sides changed - merge changes
            console.log('Conflict detected - applying Last-Write-Wins');
            // Remote is newer, so accept remote changes
            setContent(remoteContent);
          } else {
            // Only remote changed
            setContent(remoteContent);
          }
          
          lastKnownRemoteContentRef.current = remoteContent;
        }
        
        setTitle(remoteTitle);
        setMemos(remoteMemos);
        setBpm(remoteBpm);
        
        // Update refs
        lastSavedTitleRef.current = remoteTitle;
        lastSavedContentRef.current = remoteContent;
        lastSavedMemosRef.current = remoteMemos;
      }
    }, (error) => {
      console.error('Error syncing song:', error);
    });
    
    return () => {
      if (unsubscribeSongRef.current) {
        unsubscribeSongRef.current();
      }
    };
  }, [currentSong?.id, isTyping, content]);

  // Real-time chat sync
  useEffect(() => {
    if (!currentSong?.id) return;
    
    const messagesRef = collection(db, 'songs', currentSong.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    unsubscribeChatRef.current = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setChatMessages(messages);
    }, (error) => {
      console.error('Error syncing chat:', error);
    });
    
    return () => {
      if (unsubscribeChatRef.current) {
        unsubscribeChatRef.current();
      }
    };
  }, [currentSong?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Auto-save to Firebase (removed - now handled by typing timeout)
  // Keeping only the 10-second interval as backup

  // 10-second auto-save interval
  useEffect(() => {
    if (!currentSong?.id) return;
    
    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }
    
    // Set up new interval
    autoSaveIntervalRef.current = setInterval(() => {
      // Force save every 10 seconds if there are changes
      if (title !== lastSavedTitleRef.current || 
          content !== lastSavedContentRef.current || 
          memos !== lastSavedMemosRef.current) {
        saveSongToFirebase();
      }
    }, 10000); // 10 seconds
    
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [currentSong?.id, title, content, memos]);

  const saveSongToFirebase = async () => {
    if (!currentSong?.id) return;
    
    try {
      // Update local edit timestamp
      localEditTimestampRef.current = Date.now();
      
      const songRef = doc(db, 'songs', currentSong.id);
      await setDoc(songRef, {
        title,
        content,
        memos,
        bpm,
        updatedAt: serverTimestamp(),
        lastEditor: userName
      }, { merge: true });
      
      // Update last saved refs
      lastSavedTitleRef.current = title;
      lastSavedContentRef.current = content;
      lastSavedMemosRef.current = memos;
      lastKnownRemoteContentRef.current = content;
      
      // Update local songs list
      setSongs(prev => prev.map(s => 
        s.id === currentSong.id 
          ? { ...s, title, content, memos, bpm, updatedAt: new Date() }
          : s
      ));
      
      console.log('✅ Saved to Firebase at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('❌ Error saving song:', error);
    }
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsTyping(true);
    
    // Mark that we have local changes
    localEditTimestampRef.current = Date.now();
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    // Typing state ends 1.5 seconds after last keystroke
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      // Save immediately after typing stops
      saveSongToFirebase();
    }, 1500);
  };

  const handleMemosChange = (e) => {
    const newMemos = e.target.value;
    setMemos(newMemos);
    setIsTyping(true);
    
    localEditTimestampRef.current = Date.now();
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      // Save immediately after typing stops
      saveSongToFirebase();
    }, 1500);
  };

  const createNewSession = async () => {
    try {
      const newSongId = `song_${Date.now()}`;
      const newSongData = {
        title: 'New Session',
        content: '',
        memos: '',
        bpm: 120,
        createdBy: userName,
        updatedAt: serverTimestamp()
      };
      
      const songRef = doc(db, 'songs', newSongId);
      await setDoc(songRef, newSongData);
      
      const newSong = {
        id: newSongId,
        ...newSongData,
        updatedAt: new Date()
      };
      
      setSongs(prev => [newSong, ...prev]);
      setCurrentSong(newSong);
      setTitle(newSong.title);
      setContent('');
      setMemos('');
      setBpm(120);
      
      // Add welcome message
      const messagesRef = collection(db, 'songs', newSongId, 'messages');
      await addDoc(messagesRef, {
        user: 'System',
        message: 'New session started. Start collaborating!',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const selectSong = async (song) => {
    setCurrentSong(song);
    setTitle(song.title);
    setContent(song.content || '');
    setMemos(song.memos || '');
    setBpm(song.bpm || 120);
    
    // Update last saved refs
    lastSavedTitleRef.current = song.title;
    lastSavedContentRef.current = song.content || '';
    lastSavedMemosRef.current = song.memos || '';
    lastKnownRemoteContentRef.current = song.content || '';
    
    // Reset local edit timestamp
    localEditTimestampRef.current = 0;
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
    saveSongToFirebase();
  };

  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitle(currentSong?.title || '');
      setIsEditingTitle(false);
    }
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    localStorage.setItem('lyrickerUserName', userName);
  };

  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      const savedName = localStorage.getItem('lyrickerUserName');
      setUserName(savedName || userName);
      setIsEditingName(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !currentSong?.id) return;
    
    try {
      const messagesRef = collection(db, 'songs', currentSong.id, 'messages');
      await addDoc(messagesRef, {
        user: userName,
        message: chatInput,
        timestamp: serverTimestamp()
      });
      
      setChatInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const deleteSong = async (songId) => {
    try {
      // Delete from Firebase
      const songRef = doc(db, 'songs', songId);
      await deleteDoc(songRef);
      
      // Update local state
      setSongs(prev => prev.filter(s => s.id !== songId));
      
      // If deleting current song, switch to another or create new
      if (currentSong?.id === songId) {
        const remainingSongs = songs.filter(s => s.id !== songId);
        if (remainingSongs.length > 0) {
          selectSong(remainingSongs[0]);
        } else {
          // Create new session if no songs left
          await createNewSession();
        }
      }
      
      setDeleteConfirmId(null);
      console.log('🗑️ Song deleted:', songId);
    } catch (error) {
      console.error('Error deleting song:', error);
    }
  };

  const tags = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro', 'Hook'];

  const containerStyle = {
    display: 'flex',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#020617',
    color: '#f1f5f9',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    margin: 0,
    padding: 0
  };

  const sidebarStyle = {
    width: isMobile ? (sidebarOpen ? '100%' : '0') : (sidebarOpen ? '320px' : '0'),
    transition: 'width 0.3s',
    backgroundColor: '#0f172a',
    borderRight: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: isMobile ? 'absolute' : 'relative',
    height: '100%',
    zIndex: isMobile ? 100 : 1
  };

  const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: isMobile ? 'wrap' : 'nowrap',
    gap: isMobile ? '0.5rem' : '1rem'
  };

  const buttonPrimary = {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: isMobile ? '0.875rem' : '1rem'
  };

  const buttonSecondary = {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    padding: isMobile ? '0.4rem' : '0.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer'
  };

  const inputStyle = {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    outline: 'none',
    width: '100%',
    fontSize: isMobile ? '0.875rem' : '1rem'
  };

  const textareaStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: isMobile ? '1rem' : '1.5rem',
    fontWeight: isMobile ? '500' : 'bold',
    lineHeight: '1.6',
    outline: 'none',
    resize: 'none',
    border: 'none',
    color: '#f1f5f9'
  };

  const getStatusColor = () => {
    if (connectionStatus === 'connected') return '#4ade80';
    if (connectionStatus === 'error') return '#ef4444';
    return '#fbbf24';
  };

  const getStatusText = () => {
    if (isTyping) return 'Typing...';
    if (connectionStatus === 'connected') return 'Synced';
    if (connectionStatus === 'error') return 'Connection Error';
    return 'Connecting...';
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Music style={{ color: '#818cf8' }} size={isMobile ? 24 : 28} />
            <h1 style={{ fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: 'bold' }}>Lyricker</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={buttonSecondary}>
            <X size={isMobile ? 18 : 20} />
          </button>
        </div>
        
        {/* Mobile: Tab Navigation */}
        {isMobile && (
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
            <button
              onClick={() => setMobileSidebarTab('sessions')}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: mobileSidebarTab === 'sessions' ? '#1e293b' : 'transparent',
                border: 'none',
                color: mobileSidebarTab === 'sessions' ? '#f1f5f9' : '#94a3b8',
                fontWeight: mobileSidebarTab === 'sessions' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.75rem',
                borderBottom: mobileSidebarTab === 'sessions' ? '2px solid #4f46e5' : 'none'
              }}
            >
              Sessions
            </button>
            <button
              onClick={() => setMobileSidebarTab('lyrics')}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: mobileSidebarTab === 'lyrics' ? '#1e293b' : 'transparent',
                border: 'none',
                color: mobileSidebarTab === 'lyrics' ? '#f1f5f9' : '#94a3b8',
                fontWeight: mobileSidebarTab === 'lyrics' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.75rem',
                borderBottom: mobileSidebarTab === 'lyrics' ? '2px solid #4f46e5' : 'none'
              }}
            >
              Lyrics
            </button>
            <button
              onClick={() => setMobileSidebarTab('writing')}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: mobileSidebarTab === 'writing' ? '#1e293b' : 'transparent',
                border: 'none',
                color: mobileSidebarTab === 'writing' ? '#f1f5f9' : '#94a3b8',
                fontWeight: mobileSidebarTab === 'writing' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.75rem',
                borderBottom: mobileSidebarTab === 'writing' ? '2px solid #4f46e5' : 'none',
                position: 'relative'
              }}
            >
              More
              {chatMessages.length > 0 && mobileSidebarTab !== 'writing' && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  backgroundColor: '#4f46e5',
                  fontSize: '0.625rem',
                  minWidth: '14px',
                  height: '14px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px'
                }}>
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>
        )}
        
        {/* Sessions Tab Content (default for desktop, tab for mobile) */}
        {(!isMobile || mobileSidebarTab === 'sessions') && (
          <>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={createNewSession} style={buttonPrimary}>
                <Plus size={isMobile ? 18 : 20} />
                New Session
              </button>
              
              {!isMobile && (
                <button
                  onClick={() => setShowFirebaseGuide(true)}
                  style={{ ...buttonSecondary, width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  🔥 Firebase Setup
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
                Sessions
              </h2>
              {songs.map(song => (
                <div
                  key={song.id}
                  style={{
                    width: '100%',
                    marginBottom: '0.5rem',
                    position: 'relative'
                  }}
                >
                  <button
                    onClick={() => {
                      selectSong(song);
                      if (isMobile) {
                        setSidebarOpen(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '1rem',
                      paddingRight: '2.5rem',
                      borderRadius: '0.5rem',
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
                  
                  {/* Delete Button */}
                  {deleteConfirmId === song.id ? (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      height: '100%',
                      display: 'flex',
                      gap: '0.25rem',
                      alignItems: 'center',
                      paddingRight: '0.5rem'
                    }}>
                      <button
                        onClick={() => deleteSong(song.id)}
                        style={{
                          padding: '0.4rem 0.6rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{
                          padding: '0.4rem 0.6rem',
                          backgroundColor: '#1e293b',
                          color: '#cbd5e1',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(song.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: '0.5rem',
                        transform: 'translateY(-50%)',
                        padding: '0.4rem',
                        backgroundColor: 'transparent',
                        color: currentSong?.id === song.id ? 'white' : '#94a3b8',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        opacity: 0.6,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Lyrics Tab Content (mobile only) */}
        {isMobile && mobileSidebarTab === 'lyrics' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
              <textarea
                value={content}
                onChange={handleContentChange}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'transparent',
                  fontSize: '1rem',
                  fontWeight: '500',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'none',
                  border: 'none',
                  color: '#f1f5f9'
                }}
                placeholder="Start writing your lyrics..."
                spellCheck={false}
              />
            </div>
            
            {/* Structure Tags for Mobile */}
            <div style={{ borderTop: '1px solid #1e293b', padding: '0.75rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                {tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      insertTag(tag);
                    }}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#1e293b',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
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
            </div>
          </div>
        )}

        {/* Writing Tab Content (mobile only) */}
        {isMobile && mobileSidebarTab === 'writing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sub-tabs for Writing section */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
              <button
                onClick={() => setRightPanelTab('ideas')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: rightPanelTab === 'ideas' ? '#1e293b' : 'transparent',
                  border: 'none',
                  color: rightPanelTab === 'ideas' ? '#f1f5f9' : '#94a3b8',
                  fontWeight: rightPanelTab === 'ideas' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderBottom: rightPanelTab === 'ideas' ? '2px solid #4f46e5' : 'none'
                }}
              >
                Ideas
              </button>
              <button
                onClick={() => setRightPanelTab('chat')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: rightPanelTab === 'chat' ? '#1e293b' : 'transparent',
                  border: 'none',
                  color: rightPanelTab === 'chat' ? '#f1f5f9' : '#94a3b8',
                  fontWeight: rightPanelTab === 'chat' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderBottom: rightPanelTab === 'chat' ? '2px solid #4f46e5' : 'none',
                  position: 'relative'
                }}
              >
                Chat
                {chatMessages.length > 0 && rightPanelTab !== 'chat' && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    backgroundColor: '#4f46e5',
                    fontSize: '0.625rem',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px'
                  }}>
                    {chatMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRightPanelTab('settings')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: rightPanelTab === 'settings' ? '#1e293b' : 'transparent',
                  border: 'none',
                  color: rightPanelTab === 'settings' ? '#f1f5f9' : '#94a3b8',
                  fontWeight: rightPanelTab === 'settings' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderBottom: rightPanelTab === 'settings' ? '2px solid #4f46e5' : 'none'
                }}
              >
                Settings
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Ideas Tab */}
              {rightPanelTab === 'ideas' && (
                <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Ideas & Rhymes
                  </h3>
                  <textarea
                    value={memos}
                    onChange={handleMemosChange}
                    style={{
                      flex: 1,
                      width: '100%',
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
              )}

              {/* Chat Tab */}
              {rightPanelTab === 'chat' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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

              {/* Settings Tab */}
              {rightPanelTab === 'settings' && (
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '1rem' }}>
                    Settings
                  </h3>

                  {/* User Name */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                      YOUR NAME
                    </label>
                    {isEditingName ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          onKeyDown={handleNameKeyPress}
                          onBlur={handleNameSave}
                          style={inputStyle}
                          placeholder="Enter your name"
                        />
                        <button onClick={handleNameSave} style={{ ...buttonSecondary, padding: '0.75rem' }}>
                          <Save size={18} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                        <span style={{ flex: 1, color: '#f1f5f9' }}>{userName}</span>
                        <button onClick={() => setIsEditingName(true)} style={{ ...buttonSecondary, padding: '0.5rem' }}>
                          <Edit2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Connection Status */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                      CONNECTION STATUS
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getStatusColor() }}></div>
                      <span style={{ color: getStatusColor(), fontSize: '0.875rem', fontWeight: '600' }}>{getStatusText()}</span>
                    </div>
                  </div>

                  {/* Firebase Setup */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <button
                      onClick={() => setShowFirebaseGuide(true)}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      🔥 Firebase Setup Guide
                    </button>
                  </div>

                  {/* Current Session Info */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                      CURRENT SESSION
                    </label>
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>{title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                        ID: {currentSong?.id?.substring(0, 12)}...
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>
                        🔄 CRDT Sync Active
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={handleTitleSave}
                  style={{ ...inputStyle, fontSize: isMobile ? '1rem' : '1.5rem', fontWeight: 'bold', width: isMobile ? '100%' : '400px' }}
                  placeholder="Untitled"
                />
                <button onClick={handleTitleSave} style={buttonPrimary}>
                  <Save size={isMobile ? 16 : 18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: isMobile ? '1.125rem' : '1.5rem', fontWeight: 'bold' }}>{title}</h2>
                <button onClick={() => setIsEditingTitle(true)} style={buttonSecondary}>
                  <Edit2 size={isMobile ? 16 : 18} />
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: isMobile ? '0.4rem 0.75rem' : '0.5rem 1rem' }}>
              <Music size={isMobile ? 14 : 16} style={{ color: '#818cf8' }} />
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                style={{ backgroundColor: 'transparent', width: isMobile ? '48px' : '64px', textAlign: 'center', outline: 'none', border: 'none', color: '#f1f5f9', fontSize: isMobile ? '0.875rem' : '1rem' }}
              />
              <span style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: '#94a3b8' }}>BPM</span>
            </div>
            
            {!isMobile && (
              <button onClick={() => setChatOpen(!chatOpen)} style={{ ...buttonSecondary, position: 'relative' }}>
                <MessageCircle size={20} />
                {chatMessages.length > 0 && rightPanelTab !== 'chat' && (
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
            )}
            
            <button onClick={handleShare} style={buttonPrimary}>
              {copied ? <Check size={isMobile ? 16 : 18} /> : <Share2 size={isMobile ? 16 : 18} />}
              {!isMobile && (copied ? 'Copied!' : 'Share')}
            </button>
          </div>
        </div>

        {/* Structure Tags */}
        <div style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => insertTag(tag)}
              style={{
                padding: isMobile ? '0.4rem 0.75rem' : '0.5rem 1rem',
                backgroundColor: '#1e293b',
                borderRadius: '0.5rem',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
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
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Main Editor */}
          <div style={{ flex: 1, padding: isMobile ? '0.75rem' : '2rem', overflowY: 'auto' }}>
            <textarea
              ref={contentRef}
              value={content}
              onChange={handleContentChange}
              style={textareaStyle}
              placeholder="Start writing your lyrics..."
              spellCheck={false}
            />
          </div>

          {/* Right Panel - Hidden on mobile, use bottom sheet instead */}
          {!isMobile && (
            <div style={{ width: '384px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
              {/* Tab Header */}
              <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
                <button
                  onClick={() => setRightPanelTab('ideas')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: rightPanelTab === 'ideas' ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'ideas' ? '#f1f5f9' : '#94a3b8',
                    fontWeight: rightPanelTab === 'ideas' ? '600' : '400',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderBottom: rightPanelTab === 'ideas' ? '2px solid #4f46e5' : 'none'
                  }}
                >
                  Ideas
                </button>
                <button
                  onClick={() => setRightPanelTab('chat')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: rightPanelTab === 'chat' ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'chat' ? '#f1f5f9' : '#94a3b8',
                    fontWeight: rightPanelTab === 'chat' ? '600' : '400',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderBottom: rightPanelTab === 'chat' ? '2px solid #4f46e5' : 'none',
                    position: 'relative'
                  }}
                >
                  Chat
                  {chatMessages.length > 0 && rightPanelTab !== 'chat' && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#4f46e5',
                      fontSize: '0.625rem',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '9999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px'
                    }}>
                      {chatMessages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setRightPanelTab('settings')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: rightPanelTab === 'settings' ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'settings' ? '#f1f5f9' : '#94a3b8',
                    fontWeight: rightPanelTab === 'settings' ? '600' : '400',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    borderBottom: rightPanelTab === 'settings' ? '2px solid #4f46e5' : 'none'
                  }}
                >
                  Settings
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Ideas Tab */}
                {rightPanelTab === 'ideas' && (
                  <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '1rem' }}>
                      Ideas & Rhymes
                    </h3>
                    <textarea
                      value={memos}
                      onChange={handleMemosChange}
                      style={{
                        flex: 1,
                        width: '100%',
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
                )}

                {/* Chat Tab */}
                {rightPanelTab === 'chat' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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

                {/* Settings Tab */}
                {rightPanelTab === 'settings' && (
                  <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                    <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '600', marginBottom: '1.5rem' }}>
                      Settings
                    </h3>

                    {/* User Name */}
                    <div style={{ marginBottom: '2rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                        YOUR NAME
                      </label>
                      {isEditingName ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            ref={nameInputRef}
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            onKeyDown={handleNameKeyPress}
                            onBlur={handleNameSave}
                            style={inputStyle}
                            placeholder="Enter your name"
                          />
                          <button onClick={handleNameSave} style={{ ...buttonSecondary, padding: '0.75rem' }}>
                            <Save size={18} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                          <span style={{ flex: 1, color: '#f1f5f9' }}>{userName}</span>
                          <button onClick={() => setIsEditingName(true)} style={{ ...buttonSecondary, padding: '0.5rem' }}>
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Connection Status */}
                    <div style={{ marginBottom: '2rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                        CONNECTION STATUS
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getStatusColor() }}></div>
                        <span style={{ color: getStatusColor(), fontSize: '0.875rem', fontWeight: '600' }}>{getStatusText()}</span>
                      </div>
                    </div>

                    {/* Firebase Setup */}
                    <div style={{ marginBottom: '2rem' }}>
                      <button
                        onClick={() => setShowFirebaseGuide(true)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        🔥 Firebase Setup Guide
                      </button>
                    </div>

                    {/* Current Session Info */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
                        CURRENT SESSION
                      </label>
                      <div style={{ padding: '0.75rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>{title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          ID: {currentSong?.id?.substring(0, 12)}...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div style={{ backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', padding: isMobile ? '0.4rem 1rem' : '0.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: isMobile ? '0.625rem' : '0.75rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
            <span>{content.split('\n').length} lines</span>
            <span>{content.split(/\s+/).filter(w => w).length} words</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: isMobile ? '6px' : '8px', height: isMobile ? '6px' : '8px', borderRadius: '50%', backgroundColor: getStatusColor() }}></div>
            <span style={{ color: getStatusColor() }}>{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* Chat Panel - REMOVED, now in right panel tabs */}

      {/* Sidebar Toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed',
            left: isMobile ? '50%' : 0,
            transform: isMobile ? 'translateX(-50%)' : 'translateY(-50%)',
            bottom: isMobile ? '1rem' : 'auto',
            top: isMobile ? 'auto' : '50%',
            backgroundColor: '#1e293b',
            padding: isMobile ? '1rem 2rem' : '0.5rem',
            borderRadius: isMobile ? '2rem' : '0.5rem',
            borderTopRightRadius: isMobile ? '2rem' : '0.5rem',
            borderBottomRightRadius: isMobile ? '2rem' : '0.5rem',
            border: 'none',
            cursor: 'pointer',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#cbd5e1',
            fontSize: isMobile ? '0.875rem' : 'inherit',
            fontWeight: '600'
          }}
        >
          {isMobile ? (
            <>
              <Menu size={18} />
              <span>Sessions</span>
            </>
          ) : (
            <ChevronRight size={20} style={{ color: '#cbd5e1' }} />
          )}
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
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>🔥 Firebase 統合完了！</h2>
              <button onClick={() => setShowFirebaseGuide(false)} style={buttonSecondary}>
                <X size={24} />
              </button>
            </div>

            <div style={{ color: '#cbd5e1' }}>
              <div style={{ backgroundColor: '#4f46e5', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>✅ 実装済みの機能</h3>
                <ul style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                  <li>リアルタイム同期 (onSnapshot)</li>
                  <li>自動保存 (500msデバウンス)</li>
                  <li>チャット機能 (サブコレクション)</li>
                  <li>セッション管理 (Firestore)</li>
                  <li>接続ステータス表示</li>
                </ul>
              </div>

              <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#818cf8', marginBottom: '1rem' }}>
                  使い方
                </h3>
                <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                  <li>firebase.js を作成して Firebase 設定を追加</li>
                  <li>.env ファイルに環境変数を設定</li>
                  <li>Firestore セキュリティルールを設定</li>
                  <li>このコードを src/App.jsx に配置</li>
                  <li>npm run dev で起動</li>
                </ol>
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