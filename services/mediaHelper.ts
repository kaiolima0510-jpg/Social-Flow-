/**
 * Helper to robustly extract a plain media URL string from raw input,
 * resolving double-stringified JSON, object formats, and plain URLs.
 */
export function extractMediaUrl(media: any): string | null {
  if (!media) return null;

  if (typeof media === "string") {
    let cleanStr = media.trim();
    
    // Unescape quotes if wrapped in literal double quotes
    if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
      try {
        cleanStr = JSON.parse(cleanStr);
      } catch (e) {
        // Fallback to current cleanStr
      }
    }
    
    // Check if it is a JSON object string
    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanStr);
        if (parsed && typeof parsed === 'object' && parsed.url) {
          return parsed.url;
        }
      } catch (e) {
        // Not valid JSON inside braces
      }
    }
    
    return cleanStr;
  }

  if (typeof media === "object" && media !== null && media.url) {
    return media.url;
  }

  return null;
}
