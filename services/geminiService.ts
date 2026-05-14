
import { GoogleGenAI, Type } from "@google/genai";

const spinningCache = new Map<string, { variations: string[], timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5;

export const generateBatchVariations = async (
  originalText: string, 
  count: number = 3
): Promise<{ variations: string[] }> => {
  if (!originalText || originalText.length < 5) return { variations: Array(count).fill(originalText) };

  const cacheKey = `${originalText}_${count}`;
  const cached = spinningCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return { variations: cached.variations };
  }

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const urls: string[] = [];
  
  const maskedText = originalText.replace(urlRegex, (match) => {
    const placeholder = `[URL_REF_${urls.length}]`;
    urls.push(match);
    return placeholder;
  });

  if (urls.length === 0) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere ${count} variações criativas desta legenda: "${originalText}". 
        IMPORTANTE: Preserve e melhore a formatação, use quebras de linha estratégicas para listas e ingredientes, e adicione emojis pertinentes.
        Retorne estritamente um JSON no formato: {"v": ["var1", "var2"]}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { v: { type: Type.ARRAY, items: { type: Type.STRING } } },
            required: ["v"]
          }
        }
      });
      const data = JSON.parse(response.text || '{"v":[]}');
      return { variations: data.v || Array(count).fill(originalText) };
    } catch (e) {
      return { variations: Array(count).fill(originalText) };
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere ${count} variações criativas mantendo os placeholders [URL_REF_X]: "${maskedText}".
        IMPORTANTE: Use quebras de linha para organizar o texto, especialmente se for uma receita ou lista. Mantenha os links nos lugares corretos.`,
      config: {
        systemInstruction: `Você é um especialista em Copywriting para Facebook. Crie ${count} variações do texto. 
        Mantenha os placeholders [URL_REF_0], [URL_REF_1] etc exatamente como estão. 
        Use uma formatação limpa com quebras de linha para facilitar a leitura. 
        Se o texto for uma receita, separe Ingredientes e Modo de Preparo com quebras de linha.
        Retorne JSON: {"v": []}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { v: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ["v"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"v":[]}');
    const variationsRaw = data.v || [];
    
    // RESTAURAÇÃO ABSOLUTA: Remove espaços e caracteres que a IA possa ter adicionado nos colchetes
    const finalVariations = variationsRaw.map((v: string) => {
      let restored = v;
      urls.forEach((url, index) => {
        // Tenta várias combinações de formatação que a IA costuma gerar por erro
        const pattern = new RegExp(`\\[\\s*URL_REF_${index}\\s*\\]`, 'gi');
        restored = restored.replace(pattern, url);
      });
      return restored;
    });

    while (finalVariations.length < count) finalVariations.push(originalText);
    spinningCache.set(cacheKey, { variations: finalVariations, timestamp: Date.now() });
    return { variations: finalVariations };
  } catch (e) {
    return { variations: Array(count).fill(originalText) };
  }
};

/**
 * Gera legendas curtas para fotos usando o modelo Gemini 3 Flash.
 */
export const generateAlbumDescriptions = async (text: string, count: number): Promise<string[]> => {
  if (!text || count === 0) return [];
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere ${count} legendas curtas para fotos sobre: ${text}.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descriptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["descriptions"]
        }
      }
    });
    const data = JSON.parse(res.text || '{"descriptions":[]}');
    return data.descriptions || Array(count).fill("");
  } catch { 
    return Array(count).fill(""); 
  }
};

/**
 * Formata um texto (especialmente receitas) para ficar legível com quebras de linha.
 */
export const formatTextWithAI = async (text: string): Promise<string> => {
  if (!text || text.length < 10) return text;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Formate este texto para o Facebook, garantindo que listas e receitas tenham quebras de linha claras e emojis pertinentes. 
      Mantenha o conteúdo original, apenas melhore a legibilidade: "${text}"`,
    });
    return res.text || text;
  } catch {
    return text;
  }
};
