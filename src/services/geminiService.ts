import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    try {
      const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : (import.meta.env?.VITE_GEMINI_API_KEY as string);
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is missing. AI recommendations will not work.");
      }
      aiInstance = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI", e);
      // Fallback to a dummy instance that fails gracefully
      aiInstance = {
        models: {
          generateContent: async () => { throw new Error("AI not initialized"); }
        }
      } as any;
    }
  }
  return aiInstance;
}

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  topic: string;
}

export async function getBookRecommendations(bookTitle: string, author: string, description: string): Promise<BookRecommendation[]> {
  const ai = getAi();
  const prompt = `Based on the book "${bookTitle}" by ${author}, which is about: ${description}. 
  Provide 5 book recommendations that are on the same topic or have a similar vibe. 
  For each recommendation, provide the title, author, a brief reason why it's similar, and the main topic they share.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            author: { type: Type.STRING },
            reason: { type: Type.STRING },
            topic: { type: Type.STRING },
          },
          required: ["title", "author", "reason", "topic"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}
