/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageSender, FileAttachment } from '../types'; 
import MessageItem from './MessageItem';
import { Send, Menu, Paperclip, X } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string, attachments: FileAttachment[]) => void;
  isLoading: boolean;
  placeholderText?: string;
  initialQuerySuggestions?: string[];
  onSuggestedQueryClick?: (query: string) => void;
  isFetchingSuggestions?: boolean;
  onToggleSidebar?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  placeholderText,
  initialQuerySuggestions,
  onSuggestedQueryClick,
  isFetchingSuggestions,
  onToggleSidebar,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if ((userQuery.trim() || attachments.length > 0) && !isLoading) {
      onSendMessage(userQuery.trim(), attachments);
      setUserQuery('');
      setAttachments([]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newAttachments: FileAttachment[] = [];

      for (const file of filesArray) {
        if (file.type === 'application/pdf') {
          try {
            const base64 = await fileToBase64(file);
            newAttachments.push({
              name: file.name,
              mimeType: file.type,
              data: base64
            });
          } catch (error) {
            console.error("Error processing file:", file.name, error);
          }
        } else {
            alert(`Only PDF files are supported. Skipped: ${file.name}`);
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Encoded = result.split(',')[1];
        resolve(base64Encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const showSuggestions = initialQuerySuggestions && initialQuerySuggestions.length > 0 && messages.filter(m => m.sender !== MessageSender.SYSTEM).length <= 1;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#F3F4F6] rounded-t-xl">
        <div className="flex items-center gap-3">
           {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200 transition-colors md:hidden"
              aria-label="Open knowledge base"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-[#4c0c0a] font-serif tracking-wide">AI Regulatory Navigator</h2>
            {placeholderText && messages.filter(m => m.sender !== MessageSender.SYSTEM).length === 0 && (
               <p className="text-xs text-gray-500 mt-1 max-w-md truncate">{placeholderText}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto chat-container bg-white">
        {/* New wrapper for max-width and centering */}
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          
          {isFetchingSuggestions && (
              <div className="flex justify-center items-center p-3">
                  <div className="flex items-center space-x-1.5 text-gray-400">
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                      <span className="text-sm">Consulting diplomatic cables...</span>
                  </div>
              </div>
          )}

          {showSuggestions && onSuggestedQueryClick && (
            <div className="my-3 px-1">
              <p className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Suggested Inquiries: </p>
              <div className="flex flex-wrap gap-1.5">
                {initialQuerySuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestedQueryClick(suggestion)}
                    className="bg-[#F3F4F6] text-[#4c0c0a] px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-[#F9FAFB] rounded-b-xl">
        
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                 <span className="truncate max-w-[150px]">{file.name}</span>
                 <button onClick={() => removeAttachment(idx)} className="text-gray-500 hover:text-red-500">
                   <X size={12} />
                 </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="application/pdf" 
            multiple 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 p-2 text-gray-500 hover:text-[#4c0c0a] hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center"
            title="Upload PDF"
          >
            <Paperclip size={20} />
          </button>
          
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Ask a question or upload a regulatory PDF..."
            className="flex-grow h-10 min-h-[40px] py-2 px-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-lg focus:ring-1 focus:ring-[#4c0c0a] focus:border-[#4c0c0a] transition-shadow resize-none text-sm"
            rows={1}
            disabled={isLoading || isFetchingSuggestions}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || isFetchingSuggestions || (!userQuery.trim() && attachments.length === 0)}
            className="h-10 w-10 p-2 bg-[#4c0c0a] hover:bg-[#3b0908] text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center flex-shrink-0 shadow-sm"
            aria-label="Send message"
          >
            {(isLoading && messages[messages.length-1]?.isLoading && messages[messages.length-1]?.sender === MessageSender.MODEL) ? 
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
              : <Send size={18} />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;