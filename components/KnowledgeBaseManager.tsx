/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, X, Edit2, Check, ExternalLink, Upload, FileText, Globe } from 'lucide-react';
import { ReferenceSource } from '../types';

interface KnowledgeBaseManagerProps {
  sources: ReferenceSource[];
  onAddUrl: (url: string) => void;
  onAddFile: (file: File) => void;
  onRemoveSource: (id: string) => void;
  onRenameSource: (id: string, newTitle: string) => void;
  maxItems?: number;
  urlGroups: {id: string, name: string}[];
  activeUrlGroupId: string;
  onSetGroupId: (id: string) => void;
  onCloseSidebar?: () => void;
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ 
  sources, 
  onAddUrl, 
  onAddFile,
  onRemoveSource, 
  onRenameSource,
  maxItems = 50,
  urlGroups,
  activeUrlGroupId,
  onSetGroupId,
  onCloseSidebar,
}) => {
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleAddUrl = () => {
    if (!currentUrlInput.trim()) {
      setError('URL cannot be empty.');
      return;
    }
    if (!isValidUrl(currentUrlInput)) {
      setError('Invalid URL format. Please include http:// or https://');
      return;
    }
    if (sources.length >= maxItems) {
      setError(`Maximum limit reached.`);
      return;
    }
    onAddUrl(currentUrlInput);
    setCurrentUrlInput('');
    setShowUrlInput(false);
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are currently supported for the library.');
        return;
      }
      if (sources.length >= maxItems) {
        setError(`Maximum limit reached.`);
        return;
      }
      onAddFile(file);
      setError(null);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEditing = (source: ReferenceSource) => {
    setEditingSourceId(source.id);
    setEditTitleInput(source.title);
  };

  const saveEditing = () => {
    if (editingSourceId && editTitleInput.trim()) {
      onRenameSource(editingSourceId, editTitleInput.trim());
      setEditingSourceId(null);
      setEditTitleInput('');
    }
  };

  const cancelEditing = () => {
    setEditingSourceId(null);
    setEditTitleInput('');
  };

  return (
    <div className="p-4 bg-[#F9FAFB] shadow-md rounded-xl h-full flex flex-col border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#4c0c0a] font-serif">Knowledge Library</h2>
        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="p-1 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200 transition-colors md:hidden"
            aria-label="Close knowledge base"
          >
            <X size={24} />
          </button>
        )}
      </div>
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="application/pdf" 
        className="hidden" 
      />

      <div className="mb-4">
        <label htmlFor="url-group-select-kb" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Active Group
        </label>
        <div className="relative w-full mb-3">
          <select
            id="url-group-select-kb"
            value={activeUrlGroupId}
            onChange={(e) => onSetGroupId(e.target.value)}
            className="w-full py-2 pl-3 pr-8 appearance-none border border-gray-300 bg-white text-gray-800 rounded-md focus:ring-1 focus:ring-[#4c0c0a] focus:border-[#4c0c0a] text-sm shadow-sm"
          >
            {urlGroups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        <div className="flex gap-2">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sources.length >= maxItems}
                className="flex-1 py-2 px-3 bg-[#4c0c0a] hover:bg-[#3b0908] text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center text-sm font-medium shadow-sm gap-2"
            >
                <Upload size={16} />
                Upload PDF
            </button>
            <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="w-10 p-2 bg-white border border-gray-300 text-gray-600 hover:text-[#4c0c0a] rounded-lg transition-colors flex items-center justify-center shadow-sm"
                title="Add Link"
            >
                <Globe size={18} />
            </button>
        </div>
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
            type="url"
            value={currentUrlInput}
            onChange={(e) => setCurrentUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-grow h-9 py-1 px-3 border border-gray-300 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-1 focus:ring-[#4c0c0a] focus:border-[#4c0c0a] transition-shadow text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
            autoFocus
            />
            <button
            onClick={handleAddUrl}
            className="h-9 w-9 p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors flex items-center justify-center shadow-sm"
            >
            <Plus size={16} />
            </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      
      <div className="flex-grow overflow-y-auto space-y-2 chat-container pr-1">
        {sources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
             <Upload size={32} className="mb-2 opacity-50" />
             <p className="text-sm italic text-center">No documents in library.<br/>Upload a PDF to begin.</p>
          </div>
        )}
        {sources.map((source) => (
          <div key={source.id} className="flex flex-col p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
            
            {editingSourceId === source.id ? (
              <div className="flex items-center gap-2 mb-1">
                <input 
                  type="text" 
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  className="flex-grow border border-gray-300 rounded px-2 py-1 text-sm focus:border-[#4c0c0a] outline-none"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && saveEditing()}
                />
                <button onClick={saveEditing} className="text-green-600 hover:text-green-800 p-1"><Check size={14}/></button>
                <button onClick={cancelEditing} className="text-red-500 hover:text-red-700 p-1"><X size={14}/></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate flex-grow mr-2">
                    {source.type === 'file' ? (
                        <FileText size={14} className="text-[#4c0c0a] flex-shrink-0" />
                    ) : (
                        <Globe size={14} className="text-blue-600 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-800 text-sm truncate" title={source.title}>{source.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                   <button 
                    onClick={() => startEditing(source)}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={() => onRemoveSource(source.id)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
            
            {source.type === 'url' && (
                 <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-[#4c0c0a] hover:underline truncate w-full flex items-center gap-1 mt-0.5 pl-6">
                 {source.url} <ExternalLink size={8} />
               </a>
            )}
            {source.type === 'file' && (
                 <span className="text-[10px] text-gray-400 pl-6">
                    PDF Document
                 </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
