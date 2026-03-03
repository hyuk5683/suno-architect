import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Disc, Music2, Trash2, Copy, Mic2, Radio, Play, Loader2, Image as ImageIcon, Zap, AlertTriangle, Wand2, Paintbrush, Sliders, Edit3, RefreshCw, X, Check, ChevronDown, Palette, Lightbulb, Maximize2, Monitor, Smartphone } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* API SERVICE                                */
/* -------------------------------------------------------------------------- */

const apiKey = ""; // API Key injected by environment

const geminiService = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // 1. Generate Sophisticated Song Concepts (Text)
  generateSongs: async (keywords, count, musicType) => {
    try {
      const specificInstructions = musicType === 'instrumental' 
        ? `
          FOR INSTRUMENTAL TRACKS (CRITICAL):
          1. "style" FIELD (Atmospheric Performance Description):
             - Do NOT use short tags.
             - Write a DESCRIPTIVE PARAGRAPH (approx 150-200 chars) that instructs the AI how to play.
             - Describe the instruments, playing techniques, and the evolving atmosphere.
          2. "lyrics" FIELD (Detailed Musical Screenplay):
             - Do NOT write lyrics.
             - Instead, write a FULL DETAILED breakdown using [Square Brackets].
          `
        : `
          FOR VOCAL TRACKS:
          1. "style" FIELD:
             - Concise natural language description or tags (Max 120 chars).
          2. "lyrics" FIELD:
             - Write poetic, metaphorical lyrics.
             - Use [Square Brackets] ONLY for structure tags (Verse, Chorus).
          `;

      const prompt = `
        Role: World-class Music Producer & Suno AI Prompt Expert.
        Task: Create ${count} high-quality song concepts based on: "${keywords}".
        Type: ${musicType}.

        CRITICAL RULE FOR LANGUAGE:
        - Detect the exact language of the user's input: "${keywords}".
        - You MUST output the "title", "style", and the content of "lyrics" entirely in the EXACT SAME LANGUAGE as the user's input.

        ${specificInstructions}

        OUTPUT FORMAT (JSON Array Only):
        [
          {
            "id": "generate_unique_id",
            "title": "Creative Song Title",
            "style": "The descriptive performance instruction.",
            "mood": "Visual mood description for album art (in English)",
            "lyrics": {
              "structure": [
                { "tag": "[Intro]", "content": "..." },
                { "tag": "[Verse 1]", "content": "..." },
                { "tag": "[Chorus]", "content": "..." },
                { "tag": "[Outro]", "content": "..." }
              ]
            }
          }
        ]
        
        Do NOT use Markdown blocks. Return RAW JSON only.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      let text = data.candidates[0].content.parts[0].text;
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(text);
    } catch (err) {
      console.error("Text Gen Error:", err);
      throw err;
    }
  },

  // 2. Generate Artistic Prompt
  generateArtPrompt: async (song, artStyle = "Cinematic", aspectRatio = "16:9") => {
    try {
      const ratioDesc = aspectRatio === "16:9" ? "16:9 Widescreen" : "9:16 Vertical Portrait";
      const prompt = `Act as a digital art director. Create a detailed image prompt for a ${ratioDesc} album cover. Song: "${song.title}", Style: ${song.style}, Art Style: ${artStyle}. No text. Output English string only.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      return `${song.title} album cover, 8k, cinematic`;
    }
  },

  // 3. Generate Image
  generateImage: async (visualPrompt, aspectRatio = "16:9") => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: visualPrompt }],
          parameters: { sampleCount: 1, aspectRatio: aspectRatio }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
      }
    } catch (e) { console.warn(e); }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: visualPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] }
        })
      });
      const data = await response.json();
      const imgData = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (imgData) return `data:image/png;base64,${imgData}`;
    } catch (e) { console.error(e); }
    return null;
  },

  remixStyle: async (currentStyle, musicType, modification) => {
    try {
      const prompt = `Modify music style. Current: "${currentStyle}". Modification: "${modification}". Output ONLY the new style string in the original language.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) { return currentStyle; }
  },

  rewriteLyricBlock: async (tag, content, instruction) => {
    try {
      const prompt = `Rewrite the section [${tag}]. Current: "${content}". Instruction: "${instruction}". Output ONLY new content in original language.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) { return content; }
  }
};

/* -------------------------------------------------------------------------- */
/* UI COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

const InputModal = ({ isOpen, title, placeholder, onClose, onSubmit }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (isOpen && inputRef.current) setTimeout(() => inputRef.current.focus(), 100); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Edit3 className="w-5 h-5 text-indigo-400" /> {title}</h3>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-6"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400">취소</button>
          <button onClick={() => onSubmit(value)} disabled={!value.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">확인</button>
        </div>
      </div>
    </div>
  );
};

const ImagePreviewModal = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={onClose}>
      <img src={imageUrl} alt="Preview" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain" />
    </div>
  );
};

const LyricBlock = ({ tag, content, onRequestRewrite }) => (
  <div className="mb-6 group relative">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{tag}
      </h4>
      <button onClick={() => onRequestRewrite(tag)} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all">
        Refine
      </button>
    </div>
    <p className="text-slate-300 whitespace-pre-line text-sm leading-7 font-medium bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">{content}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/* MAIN APP                                   */
/* -------------------------------------------------------------------------- */

const ART_STYLES = ["Cinematic", "Digital Art", "Anime", "Oil Painting", "Cyberpunk", "Minimalist", "3D Render", "Noir"];

const App = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('vocal');
  const [songCount, setSongCount] = useState(3);
  const [songs, setSongs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [artStyle, setArtStyle] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', placeholder: '', type: '', tag: '' });
  const [previewImage, setPreviewImage] = useState(null);

  const selectedSong = songs.find(s => s.id === selectedId);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const newSongs = await geminiService.generateSongs(input, songCount, mode);
      const processed = newSongs.map(s => ({ ...s, id: Math.random().toString(36).substr(2, 9), coverUrl: null, artStatus: 'idle' }));
      setSongs(prev => [...processed, ...prev]);
      if (!selectedId && processed.length > 0) setSelectedId(processed[0].id);
    } catch (err) { alert("생성 실패"); }
    finally { setLoading(false); }
  };

  const handleGenerateArt = async (song) => {
    if (!song || song.artStatus === 'generating') return;
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'generating' } : s));
    try {
      const prompt = await geminiService.generateArtPrompt(song, artStyle, aspectRatio);
      const url = await geminiService.generateImage(prompt, aspectRatio);
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, coverUrl: url, artStatus: 'done' } : s));
    } catch (e) { 
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'error' } : s));
    }
  };

  const handleModalSubmit = async (value) => {
    setModalOpen(false);
    if (!selectedSong || !value.trim()) return;
    const songId = selectedSong.id;
    if (modalConfig.type === 'remix') {
      const style = await geminiService.remixStyle(selectedSong.style, mode, value);
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, style } : s));
    } else if (modalConfig.type === 'refine') {
      const tag = modalConfig.tag;
      const blockIndex = selectedSong.lyrics.structure.findIndex(b => b.tag === tag);
      const content = await geminiService.rewriteLyricBlock(tag, selectedSong.lyrics.structure[blockIndex].content, value);
      const newStructure = [...selectedSong.lyrics.structure];
      newStructure[blockIndex] = { ...newStructure[blockIndex], content };
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, lyrics: { ...s.lyrics, structure: newStructure } } : s));
    }
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("Copied!");
  };

  return (
    <div className="h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans overflow-hidden">
      <InputModal isOpen={modalOpen} title={modalConfig.title} placeholder={modalConfig.placeholder} onClose={() => setModalOpen(false)} onSubmit={handleModalSubmit} />
      <ImagePreviewModal isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Music2 className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none">Suno Architect <span className="text-indigo-400">Pro</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">High-Fidelity Prompt Engine</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="flex-1 w-full flex flex-col md:flex-row gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-2 items-center">
              <div className="flex bg-slate-900 rounded-md p-0.5">
                 <button type="button" onClick={() => setMode('vocal')} className={`px-3 py-1 text-[10px] font-bold rounded ${mode === 'vocal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>VOCAL</button>
                 <button type="button" onClick={() => setMode('instrumental')} className={`px-3 py-1 text-[10px] font-bold rounded ${mode === 'instrumental' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>INST</button>
              </div>
              <div className="flex items-center gap-2 px-2 border-l border-slate-800">
                <input type="range" min="1" max="10" value={songCount} onChange={(e) => setSongCount(parseInt(e.target.value))} className="w-16 h-1 accent-indigo-500"/>
                <span className="text-[10px] font-bold text-indigo-400">{songCount}</span>
              </div>
            </div>
            <div className="flex-1 flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} disabled={loading} placeholder="Enter your song idea..." className="flex-1 bg-white text-slate-900 rounded-lg px-4 text-sm font-medium" />
              <button disabled={loading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap">
                {loading ? 'GENERATING...' : 'CREATE'}
              </button>
            </div>
          </form>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        <aside className="w-72 bg-slate-900/30 border-r border-slate-800 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Disc className="w-3 h-3" /> History</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {songs.map(song => (
              <div key={song.id} onClick={() => setSelectedId(song.id)} className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedId === song.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                <h3 className={`text-xs font-bold truncate ${selectedId === song.id ? 'text-indigo-200' : 'text-slate-400'}`}>{song.title}</h3>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-[#09090b] to-[#121217]">
          {selectedSong ? (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="flex flex-col lg:flex-row gap-8 mb-10">
                <div className="shrink-0 flex flex-col gap-3">
                  <div className={`relative group w-full lg:w-80 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] lg:w-56'}`}>
                    {selectedSong.coverUrl ? (
                      <img src={selectedSong.coverUrl} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPreviewImage(selectedSong.coverUrl)} />
                    ) : (
                      <div className="text-center">
                        {selectedSong.artStatus === 'generating' ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /> : <button onClick={() => handleGenerateArt(selectedSong)} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-bold">Generate Art</button>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <select value={artStyle} onChange={e => setArtStyle(e.target.value)} className="bg-slate-900 border border-slate-800 text-[10px] p-2 rounded-lg text-slate-300">
                      {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setAspectRatio("16:9")} className={`flex-1 py-1 text-[10px] font-bold rounded-lg ${aspectRatio === "16:9" ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>16:9</button>
                      <button onClick={() => setAspectRatio("9:16")} className={`flex-1 py-1 text-[10px] font-bold rounded-lg ${aspectRatio === "9:16" ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>9:16</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                   <div className="flex gap-2 mb-4">
                     <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-bold uppercase">{selectedSong.style}</span>
                     <button onClick={() => {setModalConfig({type: 'remix', title: '스타일 리믹스', placeholder: '템포, 악기 등을 어떻게 바꿀까요?'}); setModalOpen(true);}} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold">Remix</button>
                   </div>
                   <h2 className="text-4xl font-black mb-8 leading-tight">{selectedSong.title}</h2>
                   <div className="flex flex-wrap gap-3">
                     <button onClick={() => copyToClipboard(`[Title: ${selectedSong.title}]\n[Style: ${selectedSong.style}]\n\n${selectedSong.lyrics.structure.map(p => `${p.tag}\n${p.content}`).join('\n\n')}`)} className="bg-white text-black px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2">Copy Full Prompt</button>
                     <button onClick={() => copyToClipboard(selectedSong.style)} className="bg-slate-800 text-slate-300 px-6 py-3 rounded-xl font-bold text-xs border border-slate-700">Style Only</button>
                   </div>
                </div>
              </div>

              <div className="max-w-4xl border-t border-slate-800 pt-10">
                 {selectedSong.lyrics.structure.map((block, idx) => (
                   <LyricBlock key={idx} tag={block.tag} content={block.content} onRequestRewrite={(tag) => {setModalConfig({type: 'refine', tag, title: `${tag} 파트 다듬기`, placeholder: '어떻게 수정할까요?'}); setModalOpen(true);}} />
                 ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
              <Sparkles className="w-12 h-12 mb-4 text-slate-500" />
              <p className="font-black uppercase tracking-widest text-sm text-slate-500">Design your next hit song</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;