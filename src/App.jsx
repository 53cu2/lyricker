import { useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";
import LyricNote from "./LyricNote";

export default function App() {
  useEffect(() => {
    signInAnonymously(auth);
  }, []);

  return <LyricNote />;
}
