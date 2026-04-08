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
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
  date: string;
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
  const [selectedDoc, setSelectedDoc] = useState<Document>(MOCK_DOCS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || '');
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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'model', text: "Please set your Gemini API Key in the settings first." }]);
      setIsSettingsOpen(true);
      return;
    }

    if (isOffline) {
      setMessages(prev => [...prev, { role: 'model', text: "You are currently offline. Please check your connection." }]);
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
          systemInstruction: `You are an AI Tutor. You are helping a student with a document titled "${selectedDoc.title}". 
          The content of the document is: "${selectedDoc.content}". 
          Answer questions based on this content. If the question is not related, politely guide them back to the topic or answer generally if appropriate.`,
        },
      });

      const response = await chat.sendMessage({ message: input });
      const botMessage: Message = { role: 'model', text: response.text || "I'm sorry, I couldn't process that." };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Error: Failed to connect to AI Tutor." }]);
    } finally {
      setIsLoading(false);
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
            AI Tutor
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
              placeholder="Search documents..." 
              className="w-full pl-10 pr-4 py-2 bg-[#F4F3FA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4D5E8B]/20"
            />
          </div>

          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2 mb-2">Recent Documents</p>
          
          {MOCK_DOCS.map(doc => (
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
              <MoreVertical className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${selectedDoc.id === doc.id ? 'text-white' : 'text-gray-400'}`} />
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3 p-3 bg-[#F4F3FA] rounded-2xl">
            <div className="w-10 h-10 bg-[#ACBDF1] rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-[#283964]" />
            </div>
            <div className="flex-grow overflow-hidden">
              <p className="text-sm font-bold truncate">salyman82@gmail.com</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Pro Member</p>
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
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-bold text-[#4D5E8B] hover:bg-[#F4F3FA] rounded-xl transition-colors flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Open Original
            </button>
          </div>
        </header>

        <div className="flex-grow p-10 overflow-y-auto bg-[#F8F9FB]">
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
        </div>
      </main>

      {/* Right Pane: AI Tutor Chat */}
      <section className="w-[400px] bg-white border-l border-gray-100 flex flex-col">
        <header className="p-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8CDFD] rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-[#6C567F]" />
            </div>
            <div>
              <h2 className="text-sm font-bold">AI Tutor Chat</h2>
              {isOffline ? (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Offline
                </p>
              ) : (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online & Ready</p>
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
              <h3 className="font-bold text-sm">Ask me anything about this document!</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                I can help you summarize chapters, solve problems, or explain complex concepts in simple terms.
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
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#4D5E8B] text-white rounded-tr-none' 
                    : 'bg-white text-[#30323B] border border-gray-50 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-50 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#4D5E8B]" />
                <span className="text-xs text-gray-400 font-medium">Tutor is thinking...</span>
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
              placeholder="Ask a question..."
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
            Powered by Gemini AI • Press Enter to send
          </p>
        </div>
      </section>

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
                <h2 className="text-xl font-bold">Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 bg-[#F4F3FA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4D5E8B]/20"
                  />
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Your API key is stored locally on your device and is never sent to our servers. 
                    Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#4D5E8B] hover:underline">Google AI Studio</a>.
                  </p>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveApiKey}
                  className="px-6 py-2.5 text-sm font-bold bg-[#4D5E8B] text-white rounded-xl shadow-md hover:bg-[#3A4A70] transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
