import { useState } from "react";
import { initializeApp } from "firebase/app";

/* Firebase 初期化（自分のキーに差し替え） */
initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
});

const TAGS = ["Intro", "Verse", "Chorus", "Bridge", "Outro"];

export default function App() {
  const [lyrics, setLyrics] = useState("");
  const [bpm, setBpm] = useState(90);
  const [ideas, setIdeas] = useState("");

  const insertTag = (tag) => {
    setLyrics((prev) => prev + `\n[${tag}]\n`);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Lyricker</h1>

      {/* BPM */}
      <div className="mb-4 flex items-center gap-3">
        <label className="font-semibold">BPM</label>
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          className="w-24 rounded bg-zinc-800 p-2"
        />
      </div>

      {/* Tags */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => insertTag(tag)}
            className="rounded bg-zinc-700 px-3 py-1 hover:bg-zinc-600"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Editor + Idea Box */}
      <div className="grid grid-cols-3 gap-4">
        {/* Lyrics */}
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="ここにリリックを書く"
          className="col-span-2 h-[60vh] resize-none rounded bg-zinc-800 p-4"
        />

        {/* Idea Box */}
        <textarea
          value={ideas}
          onChange={(e) => setIdeas(e.target.value)}
          placeholder="ライム / フロー / アイデア"
          className="h-[60vh] resize-none rounded bg-zinc-800 p-4"
        />
      </div>
    </div>
  );
}
