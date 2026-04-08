/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  FileText, 
  Send, 
  User, 
  Bot, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Search,
  MoreVertical,
  ExternalLink,
  Loader2,
  Settings,
  X,
  WifiOff,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { savePDF, getPDF, deletePDF, saveMessages, getMessages } from './lib/db';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
  date: string;
  url?: string;
}

const MOCK_DOCS: Document[] = [
  { 
    id: '1', 
    title: 'Quantum Physics Basics.pdf', 
    date: 'Oct 12, 2023',
    content: `Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles. It is the foundation of all quantum physics including quantum chemistry, quantum field theory, quantum technology, and quantum information science.

Classical physics, the collection of theories that existed before the advent of quantum mechanics, describes many aspects of nature at an ordinary (macroscopic) scale, but is not sufficient for describing them at small (atomic and subatomic) scales. Most theories in classical physics can be derived from quantum mechanics as an approximation valid at large (macroscopic) scale.`
  },
  { 
    id: '2', 
    title: 'Intro to Psychology.pdf', 
    date: 'Oct 10, 2023',
    content: `Psychology is the scientific study of mind and behavior. Psychology includes the study of conscious and unconscious phenomena, including feelings and thoughts. It is an academic discipline of immense scope, crossing the boundaries between the natural and social sciences.

Psychologists seek an understanding of the emergent properties of brains, linking the discipline to neuroscience. As social scientists, psychologists aim to understand the behavior of individuals and groups.`
  },
  { 
    id: '3', 
    title: 'Marketing Strategy 2024.pdf', 
    date: 'Oct 08, 2023',
    content: `Marketing strategy is a long-term, forward-looking approach and an overall game plan of any organization or any business with the fundamental goal of achieving a sustainable competitive advantage by understanding the needs and wants of customers.

It consists of all the strategies that a business uses to reach its target audience and convert them into customers. A marketing strategy contains the company's value proposition, key brand messaging, data on target customer demographics, and other high-level elements.`
  },
];

export default function App() {
  const [docs, setDocs] = useState<Document[]>(() => {
    const savedDocs = localStorage.getItem('ai_tutor_docs');
    return savedDocs ? JSON.parse(savedDocs) : MOCK_DOCS;
  });
  
  const [selectedDoc, setSelectedDoc] = useState<Document>(() => {
    const savedSelectedId = localStorage.getItem('ai_tutor_selected_doc_id');
    const savedDocs = localStorage.getItem('ai_tutor_docs');
    if (savedSelectedId && savedDocs) {
      const parsedDocs = JSON.parse(savedDocs);
      return parsedDocs.find((d: Document) => d.id === savedSelectedId) || parsedDocs[0] || MOCK_DOCS[0];
    }
    return MOCK_DOCS[0];
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // API 키가 없으면 자동으로 설정창 열기 (학생 배포용)
  useEffect(() => {
    if (!apiKey) {
      setTimeout(() => setIsSettingsOpen(true), 1000);
    }
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempKey);
    setApiKey(tempKey);
    setIsSettingsOpen(false);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Restore PDF URLs from IndexedDB on mount
  useEffect(() => {
    const restorePDFs = async () => {
      const updatedDocs = await Promise.all(docs.map(async (doc) => {
        if (doc.url) {
          try {
            const blob = await getPDF(doc.id);
            if (blob) {
              return { ...doc, url: URL.createObjectURL(blob) };
            }
          } catch (error) {
            console.error(`Failed to restore PDF for ${doc.title}:`, error);
          }
        }
        return doc;
      }));
      setDocs(updatedDocs);

      // Also update selectedDoc with the new URL if it's one of the restored ones
      if (selectedDoc.url) {
        const matchingDoc = updatedDocs.find(d => d.id === selectedDoc.id);
        if (matchingDoc) setSelectedDoc(matchingDoc);
      }
    };

    restorePDFs();
  }, []);

  // Persist docs and selection to localStorage
  useEffect(() => {
    localStorage.setItem('ai_tutor_docs', JSON.stringify(docs));
  }, [docs]);

  useEffect(() => {
    localStorage.setItem('ai_tutor_selected_doc_id', selectedDoc.id);
    
    // Load messages for the newly selected doc
    const loadChatHistory = async () => {
      try {
        const history = await getMessages(selectedDoc.id);
        if (history) {
          setMessages(history);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
        setMessages([]);
      }
    };
    loadChatHistory();
  }, [selectedDoc.id]);

  // Save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(selectedDoc.id, messages).catch(err => console.error("Failed to save chat:", err));
    }
  }, [messages, selectedDoc.id]);

  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      const pdfUrl = URL.createObjectURL(file);
      const newDoc: Document = {
        id: Date.now().toString(),
        title: file.name,
        date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' }),
        content: fullText || '이 PDF에서 텍스트를 추출할 수 없습니다.',
        url: pdfUrl
      };

      // Save binary to IndexedDB
      await savePDF(newDoc.id, file);

      setDocs([newDoc, ...docs]);
      setSelectedDoc(newDoc);
      
      // Notify the user in chat
      setMessages(prev => [...prev, { role: 'model', text: `"${file.name}" 파일을 잘 읽었습니다! 내용에 대해 무엇이든 질문해 주세요.` }]);
    } catch (error) {
      console.error("PDF Parse Error:", error);
      alert('PDF 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'model', text: "시스템을 사용하려면 먼저 오른쪽 상단 '설정' 메뉴에서 본인의 Gemini API 키를 입력해 주세요. 키가 없으면 발급 가이드를 참고하세요." }]);
      setIsSettingsOpen(true);
      return;
    }

    if (isOffline) {
      setMessages(prev => [...prev, { role: 'model', text: "현재 오프라인 상태입니다. 인터넷 연결을 확인해주세요." }]);
      return;
    }

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `당신은 AI 튜터입니다. 학생이 "${selectedDoc.title}" 문서에 대해 학습하는 것을 돕습니다. 
          문서 내용은 다음과 같습니다: "${selectedDoc.content}". 
          
          대답 규칙:
          1. 항상 한국어로 답변하세요.
          2. 정중하고 친근하게 대하되, 쓸데없는 도입부(예: "네 알겠습니다", "질문해주셔서 감사합니다")나 맺음말은 생략하고 바로 핵심 내용과 풀이 과정을 전문적으로 제시하세요.
          3. 수학 수식이나 물리 공식 등이 포함될 경우 반드시 Latex 형식을 사용하세요. (인라인: $...$, 블록: $$...$$)
          4. 문서 내용과 관련 없는 질문이라면 주제로 돌아오도록 정중하게 안내하세요.`,
        },
        // 대화 내역(history)을 기반으로 대화 유지
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const response = await chat.sendMessage({ message: input });
      const botMessage: Message = { role: 'model', text: response.text || "죄송합니다, 요청을 처리할 수 없습니다." };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "오류: AI 튜터에 연결하지 못했습니다." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDoc = async (docId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const updatedDocs = docs.filter(doc => doc.id !== docId);
    setDocs(updatedDocs);
    
    // Delete from IndexedDB if it was a PDF
    try {
      await deletePDF(docId);
    } catch (error) {
      console.warn("Failed to delete from IndexedDB:", error);
    }
    
    if (selectedDoc.id === docId) {
      if (updatedDocs.length > 0) {
        setSelectedDoc(updatedDocs[0]);
      } else {
        // Fallback or empty state could be handled here if needed
        // For now, we'll keep the last one or set to a placeholder
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#FAF8FE] text-[#30323B] overflow-hidden font-sans">
      
      {/* Left Sidebar: Document List */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-white border-r border-gray-100 flex flex-col relative"
      >
        <div className="p-6 flex items-center justify-between border-b border-gray-50">
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#4D5E8B]" />
            AI 튜터
          </h1>
          <div className="flex gap-1">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <Settings className="w-5 h-5 text-[#5D5F68]" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <Plus className="w-5 h-5 text-[#4D5E8B]" />
            </button>
          </div>
        </div>

        <div className="p-4 flex-grow overflow-y-auto space-y-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="문서 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-[#F4F3FA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4D5E8B]/20"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2 mb-2">
            {searchTerm ? `검색 결과 (${filteredDocs.length})` : '최근 문서'}
          </p>
          
          {filteredDocs.map(doc => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`w-full flex items-center p-3 rounded-2xl transition-all text-left group ${
                selectedDoc.id === doc.id ? 'bg-[#4D5E8B] text-white shadow-lg shadow-[#4D5E8B]/20' : 'hover:bg-[#F4F3FA]'
              }`}
            >
              <FileText className={`w-5 h-5 mr-3 ${selectedDoc.id === doc.id ? 'text-white' : 'text-[#4D5E8B]'}`} />
              <div className="flex-grow overflow-hidden">
                <p className="text-sm font-bold truncate">{doc.title}</p>
                <p className={`text-[10px] mt-0.5 ${selectedDoc.id === doc.id ? 'text-white/70' : 'text-gray-400'}`}>{doc.date}</p>
              </div>
              <button
                onClick={(e) => handleDeleteDoc(doc.id, e)}
                className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10 ${
                  selectedDoc.id === doc.id ? 'text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500'
                }`}
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-[#ACBDF1] rounded-2xl hover:bg-[#F4F3FA] cursor-pointer transition-colors text-[#4D5E8B] font-bold text-sm">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            {isLoading ? 'PDF 읽는 중...' : 'PDF 업로드'}
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
          </label>
        </div>

        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3 p-3 bg-[#F4F3FA] rounded-2xl">
            <div className="w-10 h-10 bg-[#ACBDF1] rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-[#283964]" />
            </div>
            <div className="flex-grow overflow-hidden">
              <p className="text-sm font-bold truncate">salyman82@gmail.com</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">프로 멤버</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Toggle Sidebar Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-[304px] top-1/2 -translate-y-1/2 z-50 bg-white border border-gray-100 shadow-md p-1 rounded-full hover:bg-gray-50 transition-all"
        style={{ left: isSidebarOpen ? '304px' : '16px' }}
      >
        {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Middle Pane: PDF Viewer */}
      <main className="flex-grow flex flex-col bg-white overflow-hidden">
        <header className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F4F3FA] rounded-lg">
              <FileText className="w-5 h-5 text-[#4D5E8B]" />
            </div>
            <h2 className="text-lg font-bold truncate max-w-md">{selectedDoc.title}</h2>
          </div>

        </header>

        <div className="flex-grow p-10 overflow-y-auto bg-[#F8F9FB]">
          {selectedDoc.url ? (
            <div className="max-w-4xl mx-auto bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden h-full min-h-[calc(100vh-160px)]">
              <iframe 
                src={`${selectedDoc.url}#view=FitH`} 
                className="w-full h-full border-0 min-h-[calc(100vh-160px)]" 
                title="PDF Viewer"
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-100 rounded-xl p-12 min-h-[1000px]">
              <div className="prose prose-slate max-w-none">
                <h1 className="text-3xl font-extrabold mb-8 text-[#30323B]">{selectedDoc.title.replace('.pdf', '')}</h1>
                <div className="space-y-6 text-[#5D5F68] leading-relaxed text-lg">
                  {selectedDoc.content.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                  
                  {/* Simulated PDF Content Filler */}
                  <div className="pt-8 space-y-4 opacity-20 select-none pointer-events-none">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Pane: AI Tutor Chat */}
      <motion.section 
        animate={{ width: isSidebarOpen ? 400 : 720 }}
        className="bg-white border-l border-gray-100 flex flex-col overflow-hidden"
      >
        <header className="p-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8CDFD] rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-[#6C567F]" />
            </div>
            <div>
              <h2 className="text-sm font-bold">AI 튜터 챗</h2>
              {isOffline ? (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> 오프라인
                </p>
              ) : (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">온라인 상태</p>
              )}
            </div>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-[#FAF8FE]/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                <Bot className="w-8 h-8 text-[#4D5E8B]" />
              </div>
              <h3 className="font-bold text-sm">이 문서에 대해 무엇이든 물어보세요!</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                단원 요약, 문제 풀이, 복잡한 개념을 쉽게 설명해 드릴 수 있습니다.
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm prose prose-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#4D5E8B] text-white rounded-tr-none prose-invert' 
                    : 'bg-white text-[#30323B] border border-gray-50 rounded-tl-none'
                }`}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-50 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#4D5E8B]" />
                <span className="text-xs text-gray-400 font-medium">튜터가 생각 중...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 border-t border-gray-50 bg-white">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="질문을 입력하세요..."
              className="w-full pl-4 pr-12 py-3 bg-[#F4F3FA] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4D5E8B]/20 resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-[#4D5E8B] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-3">
            Powered by Gemini AI • Enter 키를 눌러 전송
          </p>
        </div>
      </motion.section>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold">설정</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {!apiKey && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-xs text-red-600 font-bold flex items-center gap-2">
                      <WifiOff className="w-3 h-3" /> API 키가 설정되지 않았습니다.
                    </p>
                    <p className="text-[10px] text-red-500 mt-1">AI 튜터를 사용하려면 개인 키가 필요합니다.</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Gemini API 키 입력</label>
                  <input 
                    type="password" 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className={`w-full px-4 py-3 bg-[#F4F3FA] rounded-xl text-sm focus:outline-none focus:ring-2 ${
                      !tempKey ? 'ring-2 ring-red-200 focus:ring-red-400' : 'focus:ring-[#4D5E8B]/20'
                    }`}
                  />
                  <div className="mt-4 p-4 bg-[#F8F9FB] rounded-2xl border border-gray-100">
                    <p className="text-[11px] font-bold text-[#4D5E8B] mb-2">🔑 키 발급 방법 (1분 소요):</p>
                    <ol className="text-[10px] text-gray-600 space-y-1.5 list-decimal pl-4">
                      <li>아래 <b>'무료 키 발급받기'</b> 버튼을 클릭합니다.</li>
                      <li>Google 계정으로 로그인 후 <b>'Create API key'</b>를 누릅니다.</li>
                      <li>생성된 키를 복사해서 위 칸에 붙여넣고 저장하세요.</li>
                    </ol>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="mt-3 flex items-center justify-center gap-2 w-full p-2.5 bg-white border border-[#4D5E8B]/30 rounded-xl text-[11px] font-bold text-[#4D5E8B] hover:bg-[#4D5E8B] hover:text-white transition-all shadow-sm"
                    >
                      무료 키 발급받기 (Google AI Studio)
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={saveApiKey}
                  className="px-6 py-2.5 text-sm font-bold bg-[#4D5E8B] text-white rounded-xl shadow-md hover:bg-[#3A4A70] transition-colors"
                >
                  설정 저장
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
