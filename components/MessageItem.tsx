/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage, MessageSender } from '../types';
import { FileText } from 'lucide-react';

// Configure marked to use highlight.js for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-', // Prefix for CSS classes
} as any);

interface MessageItemProps {
  message: ChatMessage;
}

const SenderAvatar: React.FC<{ sender: MessageSender }> = ({ sender }) => {
  let avatarChar = '';
  let bgColorClass = '';
  let textColorClass = '';

  if (sender === MessageSender.USER) {
    avatarChar = 'You';
    bgColorClass = 'bg-[#4c0c0a]';
    textColorClass = 'text-white';
  } else if (sender === MessageSender.MODEL) {
    avatarChar = 'Dip'; // Diplomat
    bgColorClass = 'bg-[#E5E7EB]'; 
    textColorClass = 'text-gray-800';
  } else { // SYSTEM
    avatarChar = 'Sys';
    bgColorClass = 'bg-gray-200';
    textColorClass = 'text-gray-600';
  }

  return (
    <div className={`w-8 h-8 rounded-full ${bgColorClass} ${textColorClass} flex items-center justify-center text-[10px] font-bold uppercase tracking-wide flex-shrink-0 shadow-sm`}>
      {avatarChar}
    </div>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === MessageSender.USER;
  const isModel = message.sender === MessageSender.MODEL;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const renderMessageContent = () => {
    if (isModel && !message.isLoading) {
      const proseClasses = "prose prose-sm prose-slate w-full min-w-0 max-w-none"; 
      const rawMarkup = marked.parse(message.text || "") as string;
      return <div className={proseClasses} dangerouslySetInnerHTML={{ __html: rawMarkup }} />;
    }
    
    let textColorClass = '';
    if (isUser) {
        textColorClass = 'text-white';
    } else if (isSystem) {
        textColorClass = 'text-gray-500 italic';
    } else { 
        textColorClass = 'text-gray-800';
    }
    return <div className={`whitespace-pre-wrap text-sm ${textColorClass}`}>{message.text}</div>;
  };
  
  let bubbleClasses = "p-4 rounded-xl shadow-sm w-full ";

  if (isUser) {
    // User bubble: Deep Red background, White text
    bubbleClasses += "bg-[#4c0c0a] text-white rounded-br-none";
  } else if (isModel) {
    // Model bubble: Off-white background, Dark text
    bubbleClasses += `bg-[#F3F4F6] border border-gray-200 text-gray-800 rounded-bl-none`;
  } else { 
    // System message
    bubbleClasses += "bg-transparent text-gray-500 border border-transparent shadow-none px-0";
  }

  return (
    <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-3 max-w-[90%] md:max-w-[85%]`}>
        {!isUser && !isSystem && <SenderAvatar sender={message.sender} />}
        
        <div className="flex flex-col gap-1 w-full">
          {/* Attachments Display */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {message.attachments.map((file, idx) => (
                 <div key={idx} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg text-xs shadow-sm">
                    <FileText size={14} className="text-[#4c0c0a]" />
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                 </div>
              ))}
            </div>
          )}

          <div className={bubbleClasses}>
            {message.isLoading ? (
              <div className="flex items-center space-x-1.5 py-1">
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${isUser ? 'bg-white' : 'bg-gray-400'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${isUser ? 'bg-white' : 'bg-gray-400'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isUser ? 'bg-white' : 'bg-gray-400'}`}></div>
              </div>
            ) : (
              renderMessageContent()
            )}
            
            {isModel && message.urlContext && message.urlContext.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-300/50">
                <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-wider">Source Links:</h4>
                <ul className="space-y-1.5">
                  {message.urlContext.map((meta, index) => {
                    const statusText = typeof meta.urlRetrievalStatus === 'string' 
                      ? meta.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '') 
                      : 'UNKNOWN';
                    const isSuccess = meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';

                    return (
                      <li key={index} className="text-[11px] text-gray-500 flex items-center justify-between">
                        <a href={meta.retrievedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[90%] text-[#4c0c0a] font-medium block">
                          {meta.retrievedUrl}
                        </a>
                        {!isSuccess && <span className="text-[9px] bg-gray-200 text-gray-500 px-1 rounded ml-2">{statusText}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {isUser && <SenderAvatar sender={message.sender} />}
      </div>
    </div>
  );
};

export default MessageItem;