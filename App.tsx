
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MessageRole, Message, User, Role, ModeAccess, StudyItem, StudyItemType } from './types';
import ChatWindow from './components/ChatWindow';
import VoiceInterface from './components/VoiceInterface';
import ClassicVoiceInterface from './components/ClassicVoiceInterface';
import AuthScreen from './components/AuthScreen';
import AdminPanel from './components/AdminPanel';
import TeacherPanel from './components/TeacherPanel';
import { sendMessageStreamToGemini } from './services/geminiService';
import { api } from './services/api';
import { GoogleGenAI, Modality } from "@google/genai";

declare const mammoth: any;
declare const pdfjsLib: any;
declare const JSZip: any;

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    
    {/* Outer soft hex background */}
    <path 
      d="M60 8L102 32V88L60 112L18 88V32L60 8Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeOpacity="0.08" 
    />

    {/* AI Head */}
    <rect 
      x="35" 
      y="30" 
      width="50" 
      height="40" 
      rx="12" 
      fill="#4c84ff" 
      fillOpacity="0.9"
    />

    {/* Eyes */}
    <circle cx="50" cy="50" r="5" fill="white" />
    <circle cx="70" cy="50" r="5" fill="white" />

    {/* Smile */}
    <path 
      d="M48 62C52 68 68 68 72 62" 
      stroke="white" 
      strokeWidth="3" 
      strokeLinecap="round"
    />

    {/* Book Base */}
    <path 
      d="M35 78L60 68L85 78V95L60 105L35 95V78Z" 
      fill="#e61e6e" 
      fillOpacity="0.9"
    />

    {/* Neural dots */}
    <circle cx="60" cy="22" r="5" fill="#fbc02d" />
    <line x1="60" y1="27" x2="60" y2="30" stroke="#fbc02d" strokeWidth="3" strokeLinecap="round"/>

  </svg>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('clever_theme') === 'dark');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [engineMode, setEngineMode] = useState<'native' | 'classic'>('classic');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  
  // File Management State
  const [studyItems, setStudyItems] = useState<StudyItem[]>(() => {
    const saved = localStorage.getItem('clever_study_items');
    return saved ? JSON.parse(saved).map((i: any) => ({ ...i, createdAt: new Date(i.createdAt) })) : [];
  });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  
  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingBotText, setStreamingBotText] = useState('');

  const ttsAudioContext = useRef<AudioContext | null>(null);
  const ttsQueue = useRef<string[]>([]);
  const isPlayingTts = useRef(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('clever_study_items', JSON.stringify(studyItems));
  }, [studyItems]);

  // Combined context for the AI
  const activeStudyContext = useMemo(() => {
    const selectedFiles = studyItems.filter(i => i.type === 'file' && i.selected);
    if (selectedFiles.length === 0) return undefined;
    
    return selectedFiles.map(f => `--- DOCUMENT: ${f.name} ---\n${f.content}`).join('\n\n');
  }, [studyItems]);

  const selectedCount = useMemo(() => studyItems.filter(i => i.type === 'file' && i.selected).length, [studyItems]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('clever_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('clever_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser) setEngineMode(currentUser.modeAccess);
  }, [currentUser]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setMessages([]);
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'txt') return await file.text();
    if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } 
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }
    if (extension === 'pptx') {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let text = '';
      const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
      for (const name of slideFiles.sort()) {
        const content = await zip.file(name).async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        for (let j = 0; j < textNodes.length; j++) text += textNodes[j].textContent + ' ';
        text += '\n';
      }
      return text;
    }
    throw new Error('Bestandstype niet ondersteund');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | null = null;
    if ('files' in e) file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0] || null;
    else { e.preventDefault(); file = (e as React.DragEvent).dataTransfer.files?.[0] || null; }
    
    if (!file) return;
    setIsExtracting(true);
    try {
      const extractedText = await extractTextFromFile(file);
      const newItem: StudyItem = {
        id: Math.random().toString(36).substring(2, 11),
        name: file.name,
        type: 'file',
        parentId: currentFolderId,
        content: extractedText,
        fileType: file.name.split('.').pop() || 'txt',
        selected: true,
        createdAt: new Date()
      };
      setStudyItems(prev => [...prev, newItem]);
    } catch (err) {
      alert("Fout bij het lezen van bestand.");
    } finally { setIsExtracting(false); }
  };

  const createFolder = () => {
    const name = prompt("Geef je nieuwe map een naam:");
    if (!name || !name.trim()) return;
    const newFolder: StudyItem = {
      id: Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      type: 'folder',
      parentId: currentFolderId,
      selected: false,
      createdAt: new Date()
    };
    setStudyItems(prev => [...prev, newFolder]);
  };

  const renameItem = (id: string) => {
    const item = studyItems.find(i => i.id === id);
    if (!item || item.isLocked) return;
    const newName = prompt("Nieuwe naam:", item.name);
    if (!newName || !newName.trim()) return;
    setStudyItems(prev => prev.map(i => i.id === id ? { ...i, name: newName.trim() } : i));
  };

  const deleteItem = (id: string) => {
    const item = studyItems.find(i => i.id === id);
    if (item?.isLocked) {
      alert("Dit document is toegewezen door een docent en kan niet worden verwijderd.");
      return;
    }
    if (!confirm("Weet je zeker dat je dit item wilt verwijderen?")) return;
    setStudyItems(prev => {
      const toDelete = new Set([id]);
      let size = 0;
      while (toDelete.size !== size) {
        size = toDelete.size;
        prev.forEach(item => {
          if (item.parentId && toDelete.has(item.parentId)) toDelete.add(item.id);
        });
      }
      return prev.filter(item => !toDelete.has(item.id));
    });
  };

  const moveItem = (targetFolderId: string | null) => {
    if (!movingItemId) return;
    if (movingItemId === targetFolderId) return;
    setStudyItems(prev => prev.map(i => i.id === movingItemId ? { ...i, parentId: targetFolderId } : i));
    setMovingItemId(null);
  };

  const toggleFileSelection = (id: string) => {
    setStudyItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const toggleAllInCurrentView = (selected: boolean) => {
    const currentViewIds = new Set(studyItems.filter(i => i.parentId === currentFolderId && i.type === 'file').map(i => i.id));
    setStudyItems(prev => prev.map(i => currentViewIds.has(i.id) ? { ...i, selected } : i));
  };

  const processTtsQueue = async () => {
    if (isPlayingTts.current || ttsQueue.current.length === 0) return;
    isPlayingTts.current = true;
    const text = ttsQueue.current.shift()!;
    setIsBotSpeaking(true);
    if (engineMode === 'classic') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.onend = () => { isPlayingTts.current = false; if (ttsQueue.current.length === 0) setIsBotSpeaking(false); processTtsQueue(); };
      window.speechSynthesis.speak(utterance);
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: text }] }],
          config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } } },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          if (!ttsAudioContext.current) ttsAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          const ctx = ttsAudioContext.current;
          await ctx.resume();
          const bytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
          const dataInt16 = new Int16Array(bytes.buffer);
          const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
          buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => { isPlayingTts.current = false; if (ttsQueue.current.length === 0) setIsBotSpeaking(false); processTtsQueue(); };
          source.start();
        } else { isPlayingTts.current = false; processTtsQueue(); }
      } catch (err) { isPlayingTts.current = false; processTtsQueue(); }
    }
  };

  const playTtsChunk = (text: string) => { if (text.trim()) { ttsQueue.current.push(text.trim()); processTtsQueue(); } };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputText;
    if (!text.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), role: MessageRole.USER, text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    if (!textOverride) setInputText('');
    setIsTyping(true); setStreamingBotText(''); ttsQueue.current = [];
    const history = messages.slice(-10).map(m => ({ role: m.role, parts: m.text }));
    let fullResponse = '';
    try {
      const stream = sendMessageStreamToGemini(text, history, activeStudyContext);
      for await (const chunk of stream) {
        fullResponse += chunk; setStreamingBotText(fullResponse);
      }
      if (fullResponse.trim()) playTtsChunk(fullResponse);
      const botMessage: Message = { id: (Date.now() + 1).toString(), role: MessageRole.BOT, text: fullResponse, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]); setStreamingBotText(''); setIsTyping(false);
    } catch (err) { setIsTyping(false); }
  };

  const handleTranscriptionUpdate = useCallback((text: string, role: 'user' | 'bot') => {
    if (role === 'user') setStreamingUserText(text); else setStreamingBotText(text);
  }, []);

  const handleTurnComplete = useCallback((userText: string, botText: string) => {
    const timestamp = new Date();
    const newEntries: Message[] = [];
    if (userText.trim()) newEntries.push({ id: `v-u-${timestamp.getTime()}`, role: MessageRole.USER, text: userText.trim(), timestamp });
    if (botText.trim()) newEntries.push({ id: `v-b-${timestamp.getTime() + 1}`, role: MessageRole.BOT, text: botText.trim(), timestamp });
    if (newEntries.length > 0) setMessages(prev => [...prev, ...newEntries]);
    setStreamingUserText(''); setStreamingBotText('');
  }, []);

  const currentItems = studyItems.filter(item => item.parentId === currentFolderId);
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = studyItems.find(i => i.id === currentId);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parentId;
      } else break;
    }
    return crumbs;
  }, [currentFolderId, studyItems]);

  if (!currentUser) return <AuthScreen onLoginSuccess={(user) => setCurrentUser(user)} />;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-5xl mx-auto transition-colors duration-300">
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showTeacher && <TeacherPanel teacher={currentUser} onClose={() => setShowTeacher(false)} />}
      
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Logo className="w-14 h-14" />
          <div>
            <h1 className="text-3xl font-black text-clever-dark dark:text-white tracking-tight">StuddyBuddy</h1>
            <p className="text-clever-blue font-bold text-xs uppercase tracking-widest">Hi, {currentUser.email.split('@')[0]}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {currentUser.role === Role.ADMIN && (
            <button onClick={() => setShowAdmin(true)} className="w-12 h-12 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-lg" title="Admin">
              <i className="fa-solid fa-user-shield text-xl"></i>
            </button>
          )}

          {currentUser.role === Role.TEACHER && (
            <button onClick={() => setShowTeacher(true)} className="w-12 h-12 bg-clever-yellow text-clever-dark rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-lg" title="Klas Management">
              <i className="fa-solid fa-chalkboard-user text-xl"></i>
            </button>
          )}

          <button onClick={() => setShowSettings(true)} className="w-12 h-12 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 rounded-2xl flex items-center justify-center hover:text-clever-blue transition-all">
            <i className="fa-solid fa-gear text-xl"></i>
          </button>

          <button onClick={() => setShowUpload(true)} className={`px-5 py-3 rounded-2xl shadow-sm transition-all flex items-center space-x-2 font-bold ${selectedCount > 0 ? 'bg-clever-yellow text-clever-dark' : 'bg-white dark:bg-slate-800 text-clever-magenta border-2 border-slate-100 dark:border-slate-700'}`}>
            <i className="fa-solid fa-folder-tree"></i>
            <span className="hidden sm:inline">{selectedCount > 0 ? `${selectedCount} Gekozen` : 'Bibliotheek'}</span>
          </button>
          
          {!isVoiceActive && (
            <button onClick={() => setIsVoiceActive(true)} className="px-6 py-3 bg-clever-blue hover:bg-blue-600 text-white rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center space-x-2 font-black">
              <i className="fa-solid fa-microphone-lines"></i>
              <span className="hidden sm:inline">Start Voice</span>
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-700 p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-clever-dark dark:text-white">Instellingen</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-clever-yellow' : 'bg-clever-blue text-white'}`}><i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'} text-xl`}></i></div>
                  <span className="font-bold text-clever-dark dark:text-white">Donkere Modus</span>
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-14 h-8 rounded-full relative transition-colors ${isDarkMode ? 'bg-clever-blue' : 'bg-slate-200'}`}><div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
              </div>
              <button onClick={handleLogout} className="w-full py-4 bg-slate-100 dark:bg-slate-900 hover:bg-red-50 text-slate-600 rounded-2xl font-black transition-all flex items-center justify-center space-x-2"><i className="fa-solid fa-right-from-bracket"></i><span>Uitloggen</span></button>
              <button onClick={() => setShowSettings(false)} className="w-full mt-4 py-4 bg-clever-magenta text-white rounded-2xl font-black shadow-lg">Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-700 flex flex-col">
            <div className="p-8 border-b dark:border-slate-700 flex flex-wrap gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3 text-sm overflow-hidden">
                <button onClick={() => setCurrentFolderId(null)} className="text-clever-blue font-black hover:underline whitespace-nowrap">Bibliotheek</button>
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                    <button onClick={() => setCurrentFolderId(crumb.id)} className={`font-bold truncate max-w-[100px] ${idx === breadcrumbs.length - 1 ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{crumb.name}</button>
                  </React.Fragment>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                {movingItemId && (
                  <div className="flex items-center space-x-2 bg-clever-yellow/20 p-1 pl-3 rounded-xl border border-clever-yellow/40">
                    <span className="text-[10px] font-black uppercase text-clever-yellow-dark">Verplaatsen...</span>
                    <button onClick={() => moveItem(currentFolderId)} className="px-3 py-1.5 bg-clever-yellow text-clever-dark text-xs font-black rounded-lg hover:scale-105 transition-all">Hier</button>
                    <button onClick={() => setMovingItemId(null)} className="p-1.5 text-slate-400"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                )}
                
                <button onClick={createFolder} className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:border-clever-blue transition-all flex items-center">
                  <i className="fa-solid fa-folder-plus mr-2 text-clever-yellow"></i>
                  <span>Map</span>
                </button>
                
                <label className="px-4 py-2 bg-clever-blue text-white rounded-xl font-bold cursor-pointer hover:bg-blue-600 transition-all flex items-center">
                  <i className="fa-solid fa-cloud-arrow-up mr-2"></i>
                  <span>Upload</span>
                  <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                </label>
                
                <button onClick={() => setShowUpload(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-white dark:bg-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {currentItems.length} items in deze map
                </h3>
              </div>

              {isExtracting && (
                <div className="p-12 text-center animate-pulse">
                  <i className="fa-solid fa-spinner fa-spin text-3xl text-clever-blue"></i>
                  <p className="font-bold text-slate-400 mt-4">Bezig met verwerken...</p>
                </div>
              )}
              
              {!isExtracting && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`p-5 rounded-3xl border-2 transition-all group flex flex-col relative ${
                        item.selected 
                          ? 'bg-clever-yellow/5 border-clever-yellow/40' 
                          : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 hover:border-clever-blue/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div onClick={() => item.type === 'folder' ? setCurrentFolderId(item.id) : toggleFileSelection(item.id)} className="cursor-pointer transition-transform hover:scale-110">
                          {item.type === 'folder' ? <i className="fa-solid fa-folder text-4xl text-clever-yellow"></i> : <i className={`fa-solid fa-file-pdf text-4xl text-clever-magenta`}></i>}
                        </div>
                        
                        <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.isLocked && <i className="fa-solid fa-lock text-slate-300 p-2" title="Gereserveerd door docent"></i>}
                          {!item.isLocked && (
                            <>
                              <button onClick={() => renameItem(item.id)} className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-clever-blue transition-all"><i className="fa-solid fa-pen text-xs"></i></button>
                              <button onClick={() => setMovingItemId(item.id)} className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-clever-yellow transition-all"><i className="fa-solid fa-arrows-up-down-left-right text-xs"></i></button>
                              <button onClick={() => deleteItem(item.id)} className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-xs"></i></button>
                            </>
                          )}
                          {item.type === 'file' && <input type="checkbox" checked={item.selected} onChange={() => toggleFileSelection(item.id)} className="w-5 h-5 rounded-lg border-2 border-slate-200 text-clever-magenta cursor-pointer" />}
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                        <span onClick={() => item.type === 'folder' && setCurrentFolderId(item.id)} className="font-black text-slate-800 dark:text-slate-100 truncate block mb-1">{item.name}</span>
                        <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                           <span>{item.type === 'folder' ? 'Map' : item.fileType}</span>
                           {item.assignedByEmail && <><span className="w-1 h-1 bg-slate-200 rounded-full"></span><span className="text-clever-blue">Van: {item.assignedByEmail}</span></>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex flex-wrap gap-6 items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-clever-magenta shadow-sm"><i className="fa-solid fa-book-open-reader text-xl"></i></div>
                <div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Studie Selectie</p><p className="font-bold text-slate-700 dark:text-slate-200">{selectedCount === 0 ? 'Geen bestanden gekozen' : `${selectedCount} document(s) geselecteerd`}</p></div>
              </div>
              <button onClick={() => setShowUpload(false)} className="px-10 py-5 bg-clever-magenta text-white rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all text-lg flex items-center space-x-3"><span>Start Studie</span><i className="fa-solid fa-arrow-right"></i></button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-[70vh]">
        {engineMode === ModeAccess.NATIVE ? (
          <VoiceInterface isActive={isVoiceActive} onClose={() => setIsVoiceActive(false)} onTranscriptionUpdate={handleTranscriptionUpdate} onTurnComplete={handleTurnComplete} onBotSpeakingChange={setIsBotSpeaking} studyMaterial={activeStudyContext} />
        ) : (
          <ClassicVoiceInterface isActive={isVoiceActive} onClose={() => setIsVoiceActive(false)} onTranscriptionUpdate={handleTranscriptionUpdate} onTurnComplete={handleTurnComplete} onBotSpeakingChange={setIsBotSpeaking} studyMaterial={activeStudyContext} />
        )}
        <div className="flex flex-col flex-1">
          <ChatWindow messages={messages} isTyping={isTyping} streamingUserText={streamingUserText} streamingBotText={streamingBotText} />
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-xl border-2 border-slate-50 dark:border-slate-700 flex items-center gap-3 mt-4">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={selectedCount > 0 ? `Vraag iets over je ${selectedCount} document(en)...` : "Stel een vraag of kies je lesstof!"} className="flex-1 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none focus:ring-4 focus:ring-clever-blue/5 outline-none text-lg dark:text-white transition-all placeholder:text-slate-400" />
            <button onClick={() => handleSend()} disabled={!inputText.trim() || isTyping || isVoiceActive} className="w-16 h-16 bg-clever-blue hover:bg-blue-600 disabled:bg-slate-100 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90"><i className="fa-solid fa-paper-plane text-2xl"></i></button>
          </div>
        </div>
      </main>

      <footer className="mt-8 py-6 flex flex-col sm:flex-row justify-between items-center text-slate-300 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] gap-4">
        <span>Eureka Expert</span>
        <div className="flex space-x-4"><div className="w-3 h-3 bg-clever-blue rounded-full"></div><div className="w-3 h-3 bg-clever-magenta rounded-full"></div><div className="w-3 h-3 bg-clever-yellow rounded-full"></div></div>
        <span>© 2026 Eureka StudyBuddy</span>
      </footer>
    </div>
  );
};

export default App;
