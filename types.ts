/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface UrlContextMetadataItem {
  retrievedUrl: string;
  urlRetrievalStatus: string;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export type SourceType = 'url' | 'file';

export interface ReferenceSource {
  id: string;
  type: SourceType;
  title: string;
  // If type === 'url'
  url?: string;
  // If type === 'file'
  mimeType?: string;
  // We do NOT store the big base64 string here in the main state to keep the app responsive.
  // It is stored in IndexedDB.
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  attachments?: FileAttachment[];
}

export interface URLGroup {
  id: string;
  name: string;
  sources: ReferenceSource[];
}
