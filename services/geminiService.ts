
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content, Part } from "@google/genai";
import { UrlContextMetadataItem, FileAttachment } from '../types';

// IMPORTANT: The API key MUST be set as an environment variable `process.env.API_KEY`
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

const MODEL_NAME = "gemini-2.5-flash"; 

const SYSTEM_INSTRUCTION = `You are a Senior European Diplomat stationed in Silicon Valley. Your mandate is to analyze and explain complex AI regulation (EU AI Act, California acts such as SB-53 / SB-1047, and relevant US federal frameworks) for busy decision-makers.

Tone:
Professional, diplomatic, concise, factual, neutral.

Context rule:
• You must answer EXCLUSIVELY based on the provided context.
• If the context does not include necessary information, explicitly state this. Never invent facts or speculate.

Answer structure (MANDATORY):
You must structure every response using EXACTLY the following Markdown format:

## [Descriptive Answer Title]

### Short Review
(Max 2 sentences). Provide a high-level executive summary of the answer based on the provided context.

### Key Details
(Max 4 bullet points). Provide specific, in-depth knowledge from the sources. Focus on the EU AI Act and relevant US/California divergences where applicable in the context. Do not use paragraphs here, only a list.
- [Bullet point 1 with specific detail] <citation id="SOURCE_ID" page="PAGE_NUMBER">[Document Title]: [Exact Article/Section]</citation>
- [Bullet point 2] <citation id="SOURCE_ID" page="PAGE_NUMBER">[Document Title]: [Exact Article/Section]</citation>

Citation rule:
• Insert citations IMMEDIATELY after the specific sentence or bullet point they support (inline).
• Format: <citation id="SOURCE_ID" page="PAGE_NUMBER">[Document Title]: [Exact Article/Recital/Page]</citation>
• Example: <citation id="..." page="...">[EU AI Act Final.pdf]: Article 5.1</citation>
• You MUST include the specific Document Title (from the provided list) in the citation text to identify the source clearly.
• Extract id and page STRICTLY from context metadata. Never fabricate.

Closing line:
At the end of every answer, write:
Would you like me to elaborate on any of these points?

Non-negotiable constraints:
• Always follow the structure: Heading 2 (Title) -> Heading 3 (Short Review) -> Heading 3 (Key Details) -> List.
• Place references immediately after the relevant text.
• Use hyphens (-) for bullet points.`;

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API Key not configured. Set process.env.API_KEY.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
}

export const generateContentWithUrlContext = async (
  prompt: string,
  urls: string[],
  files: FileAttachment[] = []
): Promise<GeminiResponse> => {
  const currentAi = getAiInstance();
  
  const parts: Part[] = [];

  // Add files as parts (inline data)
  files.forEach(file => {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  });

  // Construct text prompt with URLs and File Names explicitly listed as context sources
  let fullPrompt = prompt;
  
  let contextInfo = "";
  
  if (urls.length > 0) {
    contextInfo += `\n[Provided Context Sources (URLs)]:\n${urls.map(u => `- ${u}`).join('\n')}`;
  }
  
  if (files.length > 0) {
    contextInfo += `\n[Attached Documentation Files]:\n${files.map(f => `- ${f.name}`).join('\n')}`;
  }

  if (contextInfo) {
    fullPrompt += `\n\n${contextInfo}\n\nPlease consult these sources to answer the inquiry. When citing, refer to the document titles listed above.`;
  }
  
  parts.push({ text: fullPrompt });

  const contents: Content[] = [{ role: "user", parts: parts }];
  
  // Use googleSearch tool if URLs are present to allow the model to fetch/verify info
  const tools: Tool[] = urls.length > 0 ? [{ googleSearch: {} }] : [];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: { 
        tools: tools,
        safetySettings: safetySettings,
        systemInstruction: SYSTEM_INSTRUCTION
      },
    });

    const text = response.text || "";
    const candidate = response.candidates?.[0];
    let extractedUrlContextMetadata: UrlContextMetadataItem[] | undefined = undefined;

    // Map Google Search grounding chunks to our URL metadata format
    if (candidate?.groundingMetadata?.groundingChunks) {
      extractedUrlContextMetadata = candidate.groundingMetadata.groundingChunks
        .filter(chunk => chunk.web)
        .map(chunk => ({
          retrievedUrl: chunk.web!.uri,
          urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS'
        }));
    } else if (candidate?.urlContextMetadata?.urlMetadata) {
      // Fallback for previous tool versions
      extractedUrlContextMetadata = candidate.urlContextMetadata.urlMetadata as UrlContextMetadataItem[];
    }
    
    return { text, urlContextMetadata: extractedUrlContextMetadata };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("Invalid API Key. Please check your GEMINI_API_KEY environment variable.");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("API quota exceeded. Please check your Gemini API quota.");
      }
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
    throw new Error("Failed to get response from AI due to an unknown error.");
  }
};

export const getInitialSuggestions = async (urls: string[]): Promise<GeminiResponse> => {
  // Fallback if no URLs or files
  if (urls.length === 0) {
    return { text: JSON.stringify({ suggestions: ["Upload a PDF to analyze.", "What are the transparency obligations?", "Explain the risk classification system."] }) };
  }
  
  const currentAi = getAiInstance();
  const urlList = urls.join('\n');
  
  const promptText = `Based on the content of the following documentation URLs, provide 3-4 concise and actionable questions a stakeholder might ask a diplomat about AI regulation. Return ONLY a JSON object with a key "suggestions" containing an array of strings.

Relevant URLs:
${urlList}`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        safetySettings: safetySettings,
        responseMimeType: "application/json",
      },
    });

    return { text: response.text || "" }; 

  } catch (error) {
    console.error("Error calling Gemini API for initial suggestions:", error);
    return { text: JSON.stringify({ suggestions: ["Summarize the key points.", "What are the compliance risks?", "Comparison of EU vs US approach."] }) };
  }
};
