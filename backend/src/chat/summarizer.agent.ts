// Enhanced Summarizer agent plugin
import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "summarizer",
  description: "Intelligently summarizes text, research results, or any content into concise, actionable insights.",
  handle: async (input: string, context, callAgent) => {
    try {
      if (!input || input.trim().length < 20) {
        return { 
          output: "The provided text is too short to create a meaningful summary.", 
          confidence: 0.2 
        };
      }

      // Enhanced summarization logic
      const text = input.trim();
      const words = text.split(/\s+/);
      
      // Determine summary length based on input length
      let summaryLength;
      if (words.length < 100) summaryLength = Math.max(10, Math.floor(words.length * 0.7));
      else if (words.length < 500) summaryLength = Math.max(30, Math.floor(words.length * 0.3));
      else summaryLength = Math.max(50, Math.floor(words.length * 0.2));
      
      // Extract key sentences (simple heuristic)
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      
      let summary;
      if (sentences.length <= 3) {
        // Short text - just clean it up
        summary = text.substring(0, summaryLength * 6) + (text.length > summaryLength * 6 ? "..." : "");
      } else {
        // Longer text - extract key sentences and important phrases
        const keySentences = sentences
          .filter(sentence => {
            const s = sentence.toLowerCase();
            // Prioritize sentences with important indicators
            return s.includes('important') || s.includes('key') || s.includes('main') ||
                   s.includes('significant') || s.includes('result') || s.includes('conclusion') ||
                   s.includes('therefore') || s.includes('however') || s.includes('because') ||
                   sentence.length > 20; // Prefer longer, more substantial sentences
          })
          .slice(0, 5); // Take top 5 key sentences
        
        if (keySentences.length > 0) {
          summary = keySentences.join('. ').trim();
          if (!summary.endsWith('.')) summary += '.';
        } else {
          // Fallback to first few sentences
          summary = sentences.slice(0, 3).join('. ').trim();
          if (!summary.endsWith('.')) summary += '.';
        }
      }
      
      // Calculate confidence based on text quality and length
      const confidence = Math.min(0.95, 
        0.3 + (words.length / 1000) * 0.4 + (sentences.length / 10) * 0.3
      );
      
      return { 
        output: summary, 
        confidence: confidence 
      };
      
    } catch (error) {
      return {
        output: `Summarization failed: ${error.message}`,
        confidence: 0.1
      };
    }
  }
});
