import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

const LyricNote = () => {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [memos, setMemos] = useState("");
  const [bpm, setBpm] = useState(120);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const typingTimer = useRef(null);

  /* ======================
     セッション一覧同期
  ====================== */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sessions"), snap => {
      setSongs(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });
    return unsub;
  }, []);

  /* ======================
     現在セッション同期
  ====================== */
  useEffect(() => {
    if (!currentSong) return;

    const unsub = onSnapshot(
      doc(db, "sessions", currentSong.id),
      snap => {
        const d = snap.data();
        if (!d) return;
        setTitle(d.title);
        setContent(d.content);
        setMemos(d.memos);
        setBpm(d.bpm);
      }
    );

    return unsub;
  }, [currentSong]);

  /* ======================
     自動保存（デバウンス）
  ====================== */
  useEffect(() => {
    if (!currentSong || isTyping) return;

    setDoc(
      doc(db, "sessions", currentSong.id),
      {
        title,
        content,
        memos,
        bpm,
        updatedAt: serverTimestamp(),
        uid: auth.currentUser.uid
      },
      { merge: true }
    );
  }, [title, content, memos, bpm, isTyping]);

  const handleContent = e => {
    setContent(e.target.value);
    setIsTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 800);
  };

  /* ======================
     新規セッション
  ====================== */
  const createNewSession = async () => {
    const ref = doc(collection(db, "sessions"));
    await setDoc(ref, {
      title: "New Session",
      content: "",
      memos: "",
      bpm: 120,
      createdAt: serverTimestamp()
    });
    setCurrentSong({ id: ref.id });
  };

  /* ======================
     チャット同期
  ====================== */
  useEffect(() => {
    if (!currentSong) return;

    const q = query(
      collection(db, "sessions", currentSong.id, "chat"),
      orderBy("createdAt")
    );

    const unsub = onSnapshot(q, snap => {
     
