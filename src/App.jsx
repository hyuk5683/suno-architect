import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Disc, Music2, Trash2, Copy, Mic2, Radio, Play, Loader2, Image as ImageIcon, Zap, AlertTriangle, Wand2, Paintbrush, Sliders, Edit3, RefreshCw, X, Check, ChevronDown, Palette, Lightbulb, Maximize2, Monitor, Smartphone } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* API SERVICE                                */
/* -------------------------------------------------------------------------- */

const apiKey = "";

const fetchWithRetry = async (url, options) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 401 || response.status === 403) throw new Error(`API 권한 오류: API 키를 확인해주세요.`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return response;
    } catch (error) {
      if (error.message.includes("권한")) throw error;
      if (i === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

const geminiService = {
  generateSongs: async (keywords, count, musicType) => {
    try {
      const specificInstructions = musicType === 'instrumental' 
        ? `FOR INSTRUMENTAL: Write a DESCRIPTIVE PARAGRAPH (150-200 chars) in "style". "lyrics" field should be a structural breakdown.`
        : `FOR VOCAL: Write poetic lyrics in "lyrics" structure with [Verse], [Chorus] tags.`;

      const prompt = `
        Role: World-class Music Producer.
        Task: Create ${count} concepts based on "${keywords}".
        Type: ${musicType}.
        
        CRITICAL LANGUAGE RULE:
        - Detect input language: "${keywords}".
        - Output "title" and "lyrics" content in that SAME language.
        - Output "style" content ONLY IN ENGLISH (Suno AI understands English tags best).
        
        ${specificInstructions}
        
        Format: Return ONLY a raw JSON array.
        [
          {
            "title": "Song Title",
            "style": "Description",
            "mood": "Visual mood for art (in English)",
            "lyrics": {
              "structure": [
                { "tag": "[Intro]", "content": "..." },
                { "tag": "[Verse 1]", "content": "..." }
              ]
            }
          }
        ]
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
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("API 응답이 비어있습니다.");

      // ⭐️ ChatGPT 제안 반영: 매우 강력한 JSON 파싱 방어 로직
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("JSON 파싱 실패");
        }
      }
      return parsed;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  generateArtPrompt: async (song, artStyle, aspectRatio) => {
    try {
      const prompt = `Digital art director. 8k UHD album cover artwork. Mood: ${song.mood}. Style: ${artStyle}. Aspect: ${aspectRatio}. English tags only. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY in the image. Ensure musical instruments are depicted realistically without unnatural physical phenomena.`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "artistic cover";
    } catch (e) { return "artistic cover"; }
  },

  generateImage: async (visualPrompt, aspectRatio) => {
    // 1. 완벽한 화면 비율(16:9, 9:16)을 지원하는 Imagen 4.0을 메인으로 사용
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
      if (data.predictions?.[0]) return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    } catch (e) { console.warn("Imagen 4.0 failed, trying Gemini Flash Image fallback..."); }

    // 2. 백업 모델 (Gemini Flash Image)
    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
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
      throw new Error("이미지 생성에 실패했습니다.");
    } catch (e) { throw e; }
  },

  remixStyle: async (currentStyle, musicType, modification) => {
    const prompt = `Modify music style. Current: "${currentStyle}". Request: "${modification}". Output ONLY the new style string in the original language.`;
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  },

  rewriteLyricBlock: async (tag, content, instruction) => {
    const prompt = `Rewrite section [${tag}]. Current: "${content}". Instruction: "${instruction}". Output ONLY new content in original language.`;
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
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
          <button onClick={onClose} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors">취소</button>
          <button onClick={() => onSubmit(value)} disabled={!value.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all">확인</button>
        </div>
      </div>
    </div>
  );
};

const ImagePreviewModal = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={onClose}>
      <img src={imageUrl} alt="Preview" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain bg-black" />
    </div>
  );
};

const LyricBlock = ({ tag, content, onRequestRewrite }) => (
  <div className="mb-6 group relative">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{tag}
      </h4>
      <button onClick={() => onRequestRewrite(tag)} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-all opacity-0 group-hover:opacity-100 border border-slate-700">
        <Sparkles className="w-3 h-3 text-amber-400 inline mr-1" />Refine
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
      const res = await geminiService.generateSongs(input, songCount, mode);
      
      // ⭐️ ChatGPT 제안 반영: 매우 강력한 구조 검증 및 UUID 적용
      const processed = (Array.isArray(res) ? res : []).map(s => ({
        ...s,
        id: crypto.randomUUID(), // Deprecated된 substr 대신 모던 스펙 사용
        coverUrl: null,
        artStatus: 'idle',
        lyrics: {
          structure: Array.isArray(s?.lyrics?.structure) ? s.lyrics.structure : []
        }
      }));

      if (processed.length === 0) throw new Error("생성된 곡 데이터가 없습니다.");

      setSongs(prev => [...processed, ...prev]);
      setSelectedId(processed[0].id);
    } catch (err) { 
      alert(err.message || "생성 중 오류가 발생했습니다."); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleGenerateArt = async (song, forceRegenerate = false) => {
    if (!song || (!forceRegenerate && song.artStatus === 'generating')) return;
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'generating' } : s));
    try {
      const prompt = await geminiService.generateArtPrompt(song, artStyle, aspectRatio);
      const url = await geminiService.generateImage(prompt, aspectRatio);
      if (url) {
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, coverUrl: url, artStatus: 'done' } : s));
      } else {
        throw new Error();
      }
    } catch (e) { 
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, artStatus: 'error' } : s));
      alert("이미지 생성에 실패했습니다.");
    }
  };

  const handleModalSubmit = async (value) => {
    setModalOpen(false);
    if (!selectedSong || !value.trim()) return;
    const songId = selectedSong.id;
    try {
      if (modalConfig.type === 'remix') {
        const style = await geminiService.remixStyle(selectedSong.style, mode, value);
        setSongs(prev => prev.map(s => s.id === songId ? { ...s, style } : s));
      } else if (modalConfig.type === 'refine') {
        const tag = modalConfig.tag;
        const structure = selectedSong.lyrics?.structure || [];
        const blockIndex = structure.findIndex(b => b.tag === tag);
        if (blockIndex === -1) return;

        const currentContent = structure[blockIndex].content;
        const newContent = await geminiService.rewriteLyricBlock(tag, currentContent, value);
        
        const newStructure = [...structure];
        newStructure[blockIndex] = { ...newStructure[blockIndex], content: newContent };
        
        setSongs(prev => prev.map(s => s.id === songId ? { 
          ...s, 
          lyrics: { ...s.lyrics, structure: newStructure } 
        } : s));
      }
    } catch (e) { alert("수정 중 오류가 발생했습니다."); }
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("클립보드에 복사되었습니다!");
  };

  const getFullPrompt = (song) => {
    if (!song) return "";
    const struct = song.lyrics?.structure || [];
    const lyricsText = struct.map(p => `${p.tag}\n${p.content}`).join('\n\n');
    return `[Title: ${song.title}]\n[Style: ${song.style}]\n\n${lyricsText}`;
  };

  return (
    <div className="h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans overflow-hidden selection:bg-indigo-500/30">
      <InputModal isOpen={modalOpen} title={modalConfig.title} placeholder={modalConfig.placeholder} onClose={() => setModalOpen(false)} onSubmit={handleModalSubmit} />
      <ImagePreviewModal isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      {/* HEADER */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Music2 className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none">SUNO ARCHITECT <span className="text-[9px] bg-gradient-to-r from-amber-400 to-orange-500 text-black px-1.5 py-0.5 rounded font-bold uppercase">PRO</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">High-Fidelity Prompt Engine</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="flex-1 w-full flex flex-col md:flex-row gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-2 items-center">
              <div className="flex bg-slate-900 rounded-md p-0.5">
                 <button type="button" onClick={() => setMode('vocal')} className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${mode === 'vocal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>VOCAL</button>
                 <button type="button" onClick={() => setMode('instrumental')} className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${mode === 'instrumental' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>INST</button>
              </div>
              <div className="flex items-center gap-2 px-2 border-l border-slate-800">
                <input type="range" min="1" max="5" value={songCount} onChange={(e) => setSongCount(parseInt(e.target.value))} className="w-16 h-1 accent-indigo-500 cursor-pointer"/>
                <span className="text-[10px] font-bold text-indigo-400 w-4">{songCount}</span>
              </div>
            </div>
            <div className="flex-1 flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} disabled={loading} placeholder="Describe your song idea (e.g., Sad cinematic jazz)..." className="flex-1 bg-white text-slate-900 rounded-lg px-4 text-sm font-medium outline-none" />
              <button disabled={loading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap shadow-lg shadow-indigo-500/20">
                {loading ? 'GENERATING...' : 'CREATE'}
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* SIDEBAR */}
        <aside className="w-72 bg-slate-900/30 border-r border-slate-800 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
            <Disc className="w-3 h-3" /> History
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {songs.map(song => (
              <div key={song.id} onClick={() => setSelectedId(song.id)} className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedId === song.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                <h3 className={`text-xs font-bold truncate ${selectedId === song.id ? 'text-indigo-200' : 'text-slate-400'}`}>{song.title}</h3>
                <p className="text-[10px] text-slate-600 truncate mt-1">{song.style}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* WORKSPACE */}
        <section className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-[#09090b] to-[#121217]">
          {selectedSong ? (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="flex flex-col lg:flex-row gap-8 mb-10">
                {/* ALBUM ART AREA */}
                <div className="shrink-0 flex flex-col gap-3">
                  <div className={`relative group w-full lg:w-80 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-300 ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] lg:w-56'}`}>
                    {selectedSong.coverUrl ? (
                      <>
                        <img src={selectedSong.coverUrl} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPreviewImage(selectedSong.coverUrl)} />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3 transition-opacity duration-200">
                          <div className="flex gap-2">
                            <a href={selectedSong.coverUrl} download="cover.png" className="px-4 py-2 bg-white hover:bg-slate-200 text-black rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><Copy className="w-4 h-4" /> Download</a>
                            <button onClick={() => handleGenerateArt(selectedSong, true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><RefreshCw className="w-4 h-4" /> Regenerate</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        {selectedSong.artStatus === 'generating' ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            <span className="text-[10px] font-bold text-slate-500">생성 중...</span>
                          </div>
                        ) : (
                          <button onClick={() => handleGenerateArt(selectedSong)} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all">
                            <Paintbrush className="w-3 h-3" /> Generate Art
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* ART CONTROLS */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                      <Palette className="w-3 h-3 text-slate-500" />
                      <select value={artStyle} onChange={e => setArtStyle(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-300 outline-none w-full cursor-pointer">
                        {ART_STYLES.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                      </select>
                    </div>
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 gap-1">
                      <button onClick={() => setAspectRatio("16:9")} className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${aspectRatio === "16:9" ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Monitor className="w-3 h-3 mr-1.5" /> 16:9
                      </button>
                      <button onClick={() => setAspectRatio("9:16")} className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${aspectRatio === "9:16" ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Smartphone className="w-3 h-3 mr-1.5" /> 9:16
                      </button>
                    </div>
                  </div>
                </div>

                {/* SONG INFO AREA */}
                <div className="flex-1 flex flex-col justify-center">
                   <div className="flex gap-2 mb-4">
                     <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded pl-3 pr-1 py-1">
                       <span className="text-indigo-300 text-[10px] font-black uppercase tracking-wider mr-2">{selectedSong.style}</span>
                       <button onClick={() => {setModalConfig({type: 'remix', title: '스타일 리믹스', placeholder: '템포, 악기, 분위기를 어떻게 바꿀까요?'}); setModalOpen(true);}} className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-bold flex items-center gap-1 transition-all shadow-lg shadow-indigo-500/20">
                         <Edit3 className="w-2.5 h-2.5" /> Remix
                       </button>
                     </div>
                   </div>
                   <h2 className="text-4xl font-black mb-8 leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                     {selectedSong.title}
                   </h2>
                   <div className="flex flex-wrap gap-3">
                     <button onClick={() => copyToClipboard(getFullPrompt(selectedSong))} className="bg-white hover:bg-slate-100 text-black px-6 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl shadow-white/5">
                       <Copy className="w-4 h-4" /> COPY FULL PROMPT
                     </button>
                     <button onClick={() => copyToClipboard(selectedSong.style)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 border border-slate-700">
                       <Zap className="w-4 h-4 text-amber-400" /> STYLE ONLY
                     </button>
                   </div>
                </div>
              </div>

              {/* LYRICS / STRUCTURE AREA */}
              <div className="max-w-4xl border-t border-slate-800 pt-10">
                 {(selectedSong.lyrics?.structure || []).map((block, idx) => (
                   <LyricBlock 
                    key={idx} 
                    tag={String(block.tag || "")} 
                    content={String(block.content || "")} 
                    onRequestRewrite={(tag) => {
                      setModalConfig({type: 'refine', tag, title: `${tag} 파트 다듬기`, placeholder: '가사 내용이나 연주 구성을 어떻게 수정할까요?'}); 
                      setModalOpen(true);
                    }} 
                   />
                 ))}
                 {(!selectedSong.lyrics?.structure || selectedSong.lyrics.structure.length === 0) && (
                   <div className="text-slate-600 italic text-sm text-center py-10">노래 구성 데이터가 없습니다.</div>
                 )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-6">
              <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Music2 className="w-10 h-10 text-slate-600" />
              </div>
              <p className="font-black uppercase tracking-widest text-sm text-slate-500">Design your next hit song</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;