import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Disc, Music2, Trash2, Copy, Mic2, Radio, Play, Loader2, Image as ImageIcon, Zap, AlertTriangle, Wand2, Paintbrush, Sliders, Edit3, RefreshCw, X, Check, ChevronDown, Palette, Lightbulb, Maximize2, Monitor, Smartphone } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* API SERVICE                                */
/* -------------------------------------------------------------------------- */

// API Key는 실행 환경에서 자동으로 제공됩니다.
const apiKey = ""; 

// 재시도 로직이 포함된 Fetch 헬퍼
const fetchWithRetry = async (url, options) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API 권한 오류 (${response.status}): 유효하지 않은 API 키입니다.`);
      }
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (error.message.includes("401") || error.message.includes("403")) throw error;
      if (i === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

const geminiService = {
  // 1. Generate Sophisticated Song Concepts (Text)
  generateSongs: async (keywords, count, musicType) => {
    try {
      const specificInstructions = musicType === 'instrumental' 
        ? `
          FOR INSTRUMENTAL TRACKS (CRITICAL):
          1. "style" FIELD: Write a DESCRIPTIVE PARAGRAPH (approx 150-200 chars) instructing how to play.
          2. "lyrics" FIELD: Write a FULL DETAILED breakdown using [Square Brackets]. DO NOT write actual sung lyrics.
          `
        : `
          FOR VOCAL TRACKS:
          1. "style" FIELD: Concise natural language description or tags (Max 120 chars).
          2. "lyrics" FIELD: Write poetic, metaphorical lyrics using [Square Brackets] for structure tags (Verse, Chorus).
          `;

      const prompt = `
        Role: World-class Music Producer & Suno AI Prompt Expert.
        Task: Create ${count} high-quality song concepts based on: "${keywords}".
        Type: ${musicType}.

        CRITICAL RULE FOR LANGUAGE:
        - Detect the exact language of the user's input: "${keywords}".
        - You MUST output the "title", "style", and the content of "lyrics" entirely in the EXACT SAME LANGUAGE as the user's input.
        - Example: If input is Korean, output Korean. If English, output English.
        - The JSON keys ("id", "title", "style", "mood", "lyrics", "structure", "tag", "content") MUST remain in English.

        ${specificInstructions}

        OUTPUT FORMAT (JSON Array Only):
        [
          {
            "id": "generate_unique_id",
            "title": "Creative Song Title",
            "style": "Performance instruction or tags.",
            "mood": "Visual mood description for album art (in English)",
            "lyrics": {
              "structure": [
                { "tag": "[Intro]", "content": "..." },
                { "tag": "[Verse 1]", "content": "..." }
              ]
            }
          }
        ]
        
        Do NOT use Markdown blocks. Return RAW JSON only.
      `;

      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

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
      const prompt = `Act as a digital art director. Create a highly detailed image generation prompt for a ${ratioDesc} album cover. Song Title: "${song.title}", Genre: ${song.style}, Mood: ${song.mood}, Style: ${artStyle}. Output a single string of keywords (approx 40 words) in English. No text in image.`;

      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      return `${song.title} album cover, ${song.style}, ${artStyle}, 8k, cinematic`;
    }
  },

  // 3. Generate High-Quality Image
  generateImage: async (visualPrompt, aspectRatio = "16:9") => {
    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: visualPrompt }],
          parameters: { sampleCount: 1, aspectRatio: aspectRatio }
        })
      });

      const data = await response.json();
      if (data.predictions && data.predictions[0]) {
          return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
      }
    } catch (e) {
      console.warn("Imagen 4.0 failed, trying Flash Image...");
    }

    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: visualPrompt + `, ${aspectRatio} aspect ratio, 8k resolution` }] }],
          generationConfig: { responseModalities: ["IMAGE"] }
        })
      });
      
      const data = await response.json();
      const imgData = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (imgData) return `data:image/png;base64,${imgData}`;
      throw new Error("No image data");
    } catch (e) {
      throw e; 
    }
  },

  // 4. Remix Style
  remixStyle: async (currentStyle, musicType, modification) => {
    try {
      const prompt = `Task: Modify music style. Current: "${currentStyle}". User Request: "${modification}". Output ONLY the new style string in the same language.`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) { return currentStyle; }
  },

  // 5. Rewrite Lyric/Structure Block
  rewriteLyricBlock: async (tag, content, instruction) => {
    try {
      const prompt = `Task: Rewrite [${tag}] section. Current: "${content}". Request: "${instruction}". Output ONLY the new content in the same language.`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) { return content; }
  },

  // 6. Inspiration Generator
  generateInspiration: async () => {
    try {
      const prompt = `Generate a creative music prompt for Suno AI in Korean (max 1 sentence). Ex: "비오는 사이버펑크 도시의 추격전 음악"`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) { return "한국 전통 악기가 가미된 퓨처 베이스"; }
  }
};

/* -------------------------------------------------------------------------- */
/* UI COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

const InputModal = ({ isOpen, title, placeholder, onClose, onSubmit }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current.focus(), 100);
    setValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Edit3 className="w-5 h-5 text-indigo-400" /> {title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32 mb-6"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(value); } }}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white">취소</button>
          <button onClick={() => onSubmit(value)} disabled={!value.trim()} className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50">수정하기</button>
        </div>
      </div>
    </div>
  );
};

const ImagePreviewModal = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white p-2"><X className="w-8 h-8" /></button>
      <div className="relative flex flex-col items-center justify-center gap-6 max-h-full" onClick={e => e.stopPropagation()}>
        <img src={imageUrl} alt="Preview" className="max-w-full max-h-[75vh] rounded-lg shadow-2xl object-contain bg-black" />
        <button onClick={onClose} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold backdrop-blur-md border border-white/10 flex items-center gap-2">
          <X className="w-5 h-5" /> 닫기 (Close)
        </button>
      </div>
    </div>
  );
};

const LyricBlock = ({ tag, content, onRequestRewrite }) => (
  <div className="mb-6 last:mb-0 group relative">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{tag}
      </h4>
      <button onClick={() => onRequestRewrite(tag)} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-all flex items-center gap-1 border border-slate-700 opacity-0 group-hover:opacity-100">
        <Sparkles className="w-3 h-3 text-amber-400" /> Refine
      </button>
    </div>
    <p className="text-slate-300 whitespace-pre-line text-sm leading-7 font-medium bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">{content}</p>
  </div>
);

/* -------------------------------------------------------------------------- */
/* MAIN APP                                   */
/* -------------------------------------------------------------------------- */

const ART_STYLES = ["Cinematic", "Digital Art", "Anime", "Oil Painting", "Cyberpunk", "Minimalist", "3D Render", "Watercolor", "Vintage Photo", "Noir", "Surrealism"];

const App = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('vocal');
  const [songCount, setSongCount] = useState(3);
  const [songs, setSongs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inspirating, setInspirating] = useState(false);
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
      const processedSongs = newSongs.map(s => ({ ...s, id: Math.random().toString(36).substr(2, 9), coverUrl: null, artStatus: 'idle' }));
      setSongs(prev => [...processedSongs, ...prev]);
      if (!selectedId && processedSongs.length > 0) setSelectedId(processedSongs[0].id);
    } catch (err) { alert(err.message || "생성 실패"); } 
    finally { setLoading(false); }
  };

  const handleInspireMe = async () => {
    if (inspirating) return;
    setInspirating(true);
    try { setInput(await geminiService.generateInspiration()); } 
    catch (e) { alert("아이디어 생성 실패"); } 
    finally { setInspirating(false); }
  };

  const handleGenerateArt = async (song, forceRegenerate = false) => {
    if (!song || ((song.artStatus === 'generating' || song.artStatus === 'optimizing_prompt') && !forceRegenerate)) return;
    try {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'optimizing_prompt' } : s));
      const optimizedPrompt = await geminiService.generateArtPrompt(song, artStyle, aspectRatio);
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'generating' } : s));
      const url = await geminiService.generateImage(optimizedPrompt, aspectRatio);
      if (url) setSongs(prev => prev.map(s => s.id === song.id ? { ...s, coverUrl: url, artStatus: 'done' } : s));
      else throw new Error("이미지 생성 실패");
    } catch (e) {
      alert("이미지 생성 중 오류가 발생했습니다.");
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'error' } : s));
    }
  };

  const handleModalSubmit = async (value) => {
    setModalOpen(false);
    if (!selectedSong || !value.trim()) return;
    const songId = selectedSong.id;
    if (modalConfig.type === 'remix') {
       try {
         const newStyle = await geminiService.remixStyle(selectedSong.style, mode, value);
         setSongs(prev => prev.map(s => s.id === songId ? { ...s, style: newStyle } : s));
       } catch (e) { alert("Remix 실패"); }
    } else if (modalConfig.type === 'refine') {
       try {
         const tag = modalConfig.tag;
         const blockIndex = selectedSong.lyrics.structure.findIndex(b => b.tag === tag);
         if (blockIndex === -1) return;
         const currentContent = selectedSong.lyrics.structure[blockIndex].content;
         const newContent = await geminiService.rewriteLyricBlock(tag, currentContent, value);
         const newStructure = [...selectedSong.lyrics.structure];
         newStructure[blockIndex] = { ...newStructure[blockIndex], content: newContent };
         setSongs(prev => prev.map(s => s.id === songId ? { ...s, lyrics: { ...s.lyrics, structure: newStructure } } : s));
       } catch (e) { alert("Refine 실패"); }
    }
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("복사되었습니다!");
  };

  const getFullSunoText = (song) => {
    const lyricsText = song.lyrics.structure.map(p => `${p.tag}\n${p.content}`).join('\n\n');
    return `[Title: ${song.title}]\n[Style: ${song.style}]\n\n${lyricsText}`;
  };

  return (
    <div className="h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans overflow-hidden">
      <InputModal isOpen={modalOpen} title={modalConfig.title} placeholder={modalConfig.placeholder} onClose={() => setModalOpen(false)} onSubmit={handleModalSubmit} />
      <ImagePreviewModal isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      {/* HEADER */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 z-20">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
              <Music2 className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter flex items-center gap-2">SUNO ARCHITECT <span className="text-[9px] bg-gradient-to-r from-amber-400 to-orange-500 text-black px-1.5 py-0.5 rounded font-bold uppercase">PRO</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">High-Fidelity Prompt Engine</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="flex-1 w-full flex flex-col md:flex-row gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg shrink-0 border border-slate-800 gap-2 items-center">
              <div className="flex bg-slate-900 rounded-md p-0.5">
                 <button type="button" onClick={() => setMode('vocal')} className={`px-3 py-1.5 text-[10px] font-bold rounded ${mode === 'vocal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>VOCAL</button>
                 <button type="button" onClick={() => setMode('instrumental')} className={`px-3 py-1.5 text-[10px] font-bold rounded ${mode === 'instrumental' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>INST</button>
              </div>
              <div className="flex items-center gap-2 px-2 border-l border-slate-800">
                <Sliders className="w-3 h-3 text-slate-500" />
                <input type="range" min="1" max="20" value={songCount} onChange={(e) => setSongCount(parseInt(e.target.value))} className="w-16 h-1 accent-indigo-500"/>
                <span className="text-[10px] font-bold text-indigo-400 w-4">{songCount}</span>
              </div>
            </div>
            <div className="flex-1 flex gap-2 w-full relative">
              <div className="flex-1 relative">
                <input value={input} onChange={e => setInput(e.target.value)} disabled={loading} placeholder="어떤 노래를 만들고 싶으신가요? (예: 슬픈 분위기의 재즈)" className="w-full h-full bg-white border-slate-200 border rounded-lg pl-4 pr-12 text-sm text-slate-900 py-2" />
                <button type="button" onClick={handleInspireMe} disabled={loading || inspirating} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-500">
                  {inspirating || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                </button>
              </div>
              <button disabled={loading || !input.trim()} className="bg-indigo-600 text-white px-6 rounded-lg font-bold text-sm disabled:opacity-50">
                {loading ? 'GENERATING...' : 'CREATE'}
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        <div className="w-80 bg-slate-900/30 border-r border-slate-800/50 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Disc className="w-3 h-3" /> History</span>
            {songs.length > 0 && (<button onClick={() => setSongs([])} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {songs.map(song => (
              <div key={song.id} onClick={() => setSelectedId(song.id)} className={`p-3 rounded-xl cursor-pointer border flex gap-3 ${selectedId === song.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                <div className={`w-12 h-8 rounded-md flex items-center justify-center overflow-hidden border ${song.coverUrl ? 'border-transparent' : 'border-slate-800 bg-slate-900'}`}>
                  {song.coverUrl ? <img src={song.coverUrl} className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-slate-700">ART</span>}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <h3 className={`text-xs font-bold truncate ${selectedId === song.id ? 'text-indigo-200' : 'text-slate-400'}`}>{song.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          {selectedSong ? (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="flex flex-col lg:flex-row gap-8 mb-10">
                <div className="shrink-0 flex flex-col gap-3">
                  <div className={`relative group w-full lg:w-96 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] lg:w-64'}`}>
                      {selectedSong.coverUrl ? (
                        <>
                          <img src={selectedSong.coverUrl} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPreviewImage(selectedSong.coverUrl)} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3">
                             <div className="flex gap-2">
                               <a href={selectedSong.coverUrl} download={`cover.png`} className="px-4 py-2 bg-white text-black rounded-lg text-xs font-bold flex items-center gap-2"><Copy className="w-4 h-4" /> Download</a>
                               <button onClick={() => handleGenerateArt(selectedSong, true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Regenerate</button>
                             </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6 w-full h-full flex flex-col items-center justify-center">
                          {selectedSong.artStatus === 'generating' || selectedSong.artStatus === 'optimizing_prompt' ? (
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                          ) : (
                            <button onClick={() => handleGenerateArt(selectedSong)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2"><Paintbrush className="w-3.5 h-3.5" /> Generate Art</button>
                          )}
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                      <Palette className="w-3 h-3 text-slate-500" />
                      <select value={artStyle} onChange={(e) => setArtStyle(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-300 outline-none w-full">
                        {ART_STYLES.map(style => <option key={style} value={style} className="bg-slate-900">{style}</option>)}
                      </select>
                    </div>
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 gap-1">
                      <button onClick={() => setAspectRatio("16:9")} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${aspectRatio === "16:9" ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>16:9</button>
                      <button onClick={() => setAspectRatio("9:16")} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${aspectRatio === "9:16" ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>9:16</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                   <div className="flex gap-2 mb-4">
                     <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded pl-3 pr-1 py-1">
                       <span className="text-indigo-300 text-[11px] font-black uppercase mr-2">{selectedSong.style}</span>
                       <button onClick={() => {setModalConfig({type: 'remix', title: '리믹스', placeholder: '어떻게 바꿀까요?'}); setModalOpen(true);}} className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-bold flex items-center gap-1"><Edit3 className="w-2.5 h-2.5" /> Remix</button>
                     </div>
                   </div>
                   <h2 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-8">{selectedSong.title}</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                     <button onClick={() => copyToClipboard(getFullSunoText(selectedSong))} className="bg-white text-black px-6 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> COPY FULL PROMPT</button>
                     <button onClick={() => copyToClipboard(selectedSong.style)} className="bg-slate-800 text-slate-300 px-6 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> COPY STYLE ONLY</button>
                   </div>
                </div>
              </div>

              <div className="max-w-4xl space-y-2">
                 {selectedSong.lyrics.structure.map((block, idx) => (
                   <LyricBlock key={idx} tag={block.tag} content={block.content} onRequestRewrite={(tag) => {setModalConfig({type: 'refine', tag: tag, title: '다듬기', placeholder: '어떻게 수정할까요?'}); setModalOpen(true);}} />
                 ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-6 opacity-40">
              <Sparkles className="w-10 h-10 text-slate-600" />
              <p className="font-black uppercase tracking-widest text-sm">Design your next hit song</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;