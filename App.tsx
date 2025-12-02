/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageSender, URLGroup, FileAttachment, ReferenceSource } from './types';
import { generateContentWithUrlContext, getInitialSuggestions } from './services/geminiService';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import ChatInterface from './components/ChatInterface';
import { initDB, saveFileToDB, getAllFilesFromDB, deleteFileFromDB, getFileFromDB, StoredFile } from './utils/db';

const INITIAL_URL_GROUPS: URLGroup[] = [
  { 
    id: 'default-library', 
    name: 'My Knowledge Library', 
    sources: [] 
  },
];

const STORAGE_KEY = 'ai_reg_navigator_sources_v2'; // Bumped version for new schema

const App: React.FC = () => {
  // Initialize state
  const [urlGroups, setUrlGroups] = useState<URLGroup[]>(INITIAL_URL_GROUPS);
  const [activeUrlGroupId, setActiveUrlGroupId] = useState<string>(INITIAL_URL_GROUPS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);
  
  const MAX_ITEMS = 50;

  // Initialize DB and load persist data
  useEffect(() => {
    const initializeData = async () => {
      try {
        await initDB();
        
        // Load persist sources (metadata) from LocalStorage
        const savedMeta = localStorage.getItem(STORAGE_KEY);
        let groups = INITIAL_URL_GROUPS;
        if (savedMeta) {
          groups = JSON.parse(savedMeta);
        }

        // Load files from IndexedDB to sync (in case local storage got out of sync or clean start)
        const dbFiles = await getAllFilesFromDB();
        
        // We ensure that files in DB are represented in the UI
        // This is a simple sync: if DB has file, make sure it's in the default group if not elsewhere
        setUrlGroups(prev => {
          // If we loaded groups from local storage, use them, but verify files exist? 
          // For simplicity, we assume LocalStorage is the source of truth for organization
          // and IDB is the source of truth for data.
          // However, if LocalStorage is empty but DB has files, we should add them.
          
          const newGroups = [...groups];
          const defaultGroup = newGroups.find(g => g.id === 'default-library') || newGroups[0];
          
          dbFiles.forEach(file => {
             const isKnown = newGroups.some(g => g.sources.some(s => s.id === file.id));
             if (!isKnown) {
               // Add orphaned DB file to UI
               defaultGroup.sources.push({
                 id: file.id,
                 type: 'file',
                 title: file.name,
                 mimeType: file.mimeType
               });
             }
          });
          
          return newGroups;
        });

      } catch (e) {
        console.error("Failed to initialize storage", e);
      }
    };
    
    initializeData();
  }, []);

  // Persist Metadata to Local Storage whenever urlGroups changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(urlGroups));
    } catch (e) {
      console.error("Failed to save sources metadata to local storage", e);
    }
  }, [urlGroups]);

  const activeGroup = urlGroups.find(g => g.id === activeUrlGroupId) || urlGroups[0];
  const activeSources = activeGroup.sources;

  const handleAddSource = (url: string) => {
    const newSource: ReferenceSource = {
      id: `src-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'url',
      url: url,
      title: url 
    };

    setUrlGroups(prevGroups => prevGroups.map(group => {
      if (group.id === activeUrlGroupId) {
        return { ...group, sources: [...group.sources, newSource] };
      }
      return group;
    }));
  };

  const handleAddPersistentFile = async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const storedFile: StoredFile = {
        id,
        name: file.name,
        mimeType: file.type,
        data: base64,
        date: new Date()
      };

      // Save to IndexedDB
      await saveFileToDB(storedFile);

      // Add to State (Metadata only)
      const newSource: ReferenceSource = {
        id,
        type: 'file',
        title: file.name,
        mimeType: file.type
      };

      setUrlGroups(prevGroups => prevGroups.map(group => {
        if (group.id === activeUrlGroupId) {
          return { ...group, sources: [...group.sources, newSource] };
        }
        return group;
      }));

    } catch (e) {
      console.error("Error saving file", e);
      alert("Failed to save file to library.");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Encoded = result.split(',')[1];
        resolve(base64Encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleRemoveSource = async (sourceId: string) => {
    // Check if it's a file, if so delete from DB
    const group = urlGroups.find(g => g.sources.some(s => s.id === sourceId));
    const source = group?.sources.find(s => s.id === sourceId);

    if (source && source.type === 'file') {
      try {
        await deleteFileFromDB(sourceId);
      } catch (e) {
        console.error("Error deleting file from DB", e);
      }
    }

    setUrlGroups(prevGroups => prevGroups.map(g => {
        return { ...g, sources: g.sources.filter(s => s.id !== sourceId) };
    }));
  };

  const handleRenameSource = (sourceId: string, newTitle: string) => {
    setUrlGroups(prevGroups => prevGroups.map(group => {
        return { 
          ...group, 
          sources: group.sources.map(s => s.id === sourceId ? { ...s, title: newTitle } : s) 
        };
    }));
  };

  const handleSendMessage = async (query: string, tempAttachments: FileAttachment[]) => {
    setIsLoading(true);

    // 1. Gather Context
    const urls: string[] = [];
    const filesToSend: FileAttachment[] = [...tempAttachments];

    // 2. Fetch Persisted Files from DB for active sources
    for (const source of activeSources) {
      if (source.type === 'url' && source.url) {
        urls.push(source.url);
      } else if (source.type === 'file') {
        try {
          const dbFile = await getFileFromDB(source.id);
          if (dbFile) {
            filesToSend.push({
              name: source.title, // Use the renamed title if applicable
              mimeType: dbFile.mimeType,
              data: dbFile.data
            });
          }
        } catch (e) {
          console.error(`Failed to load file ${source.id}`, e);
        }
      }
    }
    
    // Create User Message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: query,
      sender: MessageSender.USER,
      timestamp: new Date(),
      attachments: tempAttachments // Only show temp attachments in bubble? Or all? Usually just what user "sent" this turn.
    };

    setChatMessages(prev => [...prev, userMessage]);

    // Create placeholder
    const placeholderMessageId = (Date.now() + 1).toString();
    const placeholderMessage: ChatMessage = {
      id: placeholderMessageId,
      text: '',
      sender: MessageSender.MODEL,
      timestamp: new Date(),
      isLoading: true,
    };
    setChatMessages(prev => [...prev, placeholderMessage]);

    try {
      const response = await generateContentWithUrlContext(query, urls, filesToSend);

      setChatMessages(prev => prev.map(msg => {
        if (msg.id === placeholderMessageId) {
          return {
            ...msg,
            text: response.text,
            isLoading: false,
            urlContext: response.urlContextMetadata
          };
        }
        return msg;
      }));
    } catch (error) {
      setChatMessages(prev => prev.map(msg => {
        if (msg.id === placeholderMessageId) {
          return {
            ...msg,
            text: "Apologies, I encountered a diplomatic communication error. Please ensure your files are valid and try again.",
            isLoading: false,
          };
        }
        return msg;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch initial suggestions based on context
  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        // Just use URLs for suggestions to save bandwidth/complexity? 
        // Or if we have files, maybe just generic suggestions?
        const activeUrls = activeSources.filter(s => s.type === 'url').map(s => s.url!);
        
        // If we have files but no URLs, we can prompt generically about the files
        if (activeUrls.length > 0) {
           const result = await getInitialSuggestions(activeUrls);
           try {
             const parsed = JSON.parse(result.text);
             if (parsed.suggestions) {
               setInitialQuerySuggestions(parsed.suggestions);
             }
           } catch (e) {
             // fallback
           }
        } else if (activeSources.some(s => s.type === 'file')) {
           setInitialQuerySuggestions([
             "Summarize the key compliance obligations in these documents.",
             "Are there any definitions of 'High-Risk AI'?",
             "Compare the requirements here with the EU AI Act."
           ]);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };
    
    if (chatMessages.length === 0) {
      fetchSuggestions();
    }
  }, [activeUrlGroupId, activeSources.length]);

  // Initial welcome message
  useEffect(() => {
    if (chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'system-welcome',
        text: "Greetings. I am your Regulatory Envoy. Please upload your regulatory documents (PDFs) to the library on the left. They will be securely stored for our briefing sessions.",
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
      };
      setChatMessages([welcomeMessage]);
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-800">
      {/* Sidebar - Desktop */}
      <div className={`hidden md:flex flex-col w-80 h-full border-r border-gray-200 bg-[#F9FAFB]`}>
        <KnowledgeBaseManager 
          sources={activeSources}
          onAddUrl={handleAddSource}
          onAddFile={handleAddPersistentFile}
          onRemoveSource={handleRemoveSource}
          onRenameSource={handleRenameSource}
          maxItems={MAX_ITEMS}
          urlGroups={urlGroups.map(g => ({ id: g.id, name: g.name }))}
          activeUrlGroupId={activeUrlGroupId}
          onSetGroupId={setActiveUrlGroupId}
        />
      </div>

       {/* Sidebar - Mobile */}
       {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-80 h-full bg-[#F9FAFB] shadow-xl border-r border-gray-200">
             <KnowledgeBaseManager 
                sources={activeSources}
                onAddUrl={handleAddSource}
                onAddFile={handleAddPersistentFile}
                onRemoveSource={handleRemoveSource}
                onRenameSource={handleRenameSource}
                maxItems={MAX_ITEMS}
                urlGroups={urlGroups.map(g => ({ id: g.id, name: g.name }))}
                activeUrlGroupId={activeUrlGroupId}
                onSetGroupId={setActiveUrlGroupId}
                onCloseSidebar={() => setIsSidebarOpen(false)}
              />
          </div>
          <div className="flex-grow bg-black/20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-grow h-full flex flex-col relative bg-white">
        <div className="flex-grow h-full max-w-5xl mx-auto w-full p-4 md:p-6">
           <ChatInterface 
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholderText="Inquire about the uploaded documents..."
            initialQuerySuggestions={initialQuerySuggestions}
            onSuggestedQueryClick={(q) => handleSendMessage(q, [])}
            isFetchingSuggestions={isFetchingSuggestions}
            onToggleSidebar={() => setIsSidebarOpen(true)}
           />
        </div>
      </div>
    </div>
  );
};

export default App;
