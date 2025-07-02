// document-search.agent.ts
import { AgentRegistry } from "./agent-registry";
import { ChromaClient } from 'chromadb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Logger } from "@nestjs/common";

const logger = new Logger('DocumentSearchAgent');

// Helper function to extract keywords from a question for better search recall
const extractQuestionKeywords = (question: string): string[] => {
  const questionLower = question.toLowerCase();
  const keywords: string[] = [];
  
  // Add specific references like "Article 5"
  const articleRefs = questionLower.match(/artículo\s+\d+|article\s+\d+/g);
  if (articleRefs) {
    keywords.push(...articleRefs);
  }
  
  // Add important words, filtering out common stop words
  const importantWords = questionLower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !['what', 'como', 'donde', 'cuando', 'porque', 'cual', 'quien', 'dice', 'trata', 'contiene', 'sobre', 'acerca', 'este', 'archivo'].includes(word)
    );
  keywords.push(...importantWords);
  
  // Add high-value terms if present
  if (questionLower.includes('constitución') || questionLower.includes('constitution')) {
    keywords.push('constitución', 'constitution');
  }
  
  return [...new Set(keywords)]; // Return unique keywords
};

AgentRegistry.register({
  name: "document_search",
  description: "Searches through user-uploaded documents to find specific information and provide a summarized answer.",
  handle: async (input, context, callAgent) => {
    const { userId, geminiApiKey } = context;

    if (!userId) {
      return { output: "Cannot search documents without a user session.", confidence: 0.1 };
    }
    if (!geminiApiKey) {
      return { output: "Cannot search documents without a valid API key.", confidence: 0.1 };
    }

    try {
      // Step 1: Retrieve relevant document chunks from ChromaDB
      const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
      const chroma = new ChromaClient({ path: chromaUrl });
      const collectionName = `user_${userId}`;
      
      let collection;
      try {
        collection = await chroma.getCollection({ name: collectionName });
      } catch (error) {
        logger.warn(`ChromaDB collection '${collectionName}' not found or Chroma not available.`);
        return { output: "No documents found to search. Please upload a document first.", confidence: 0.4 };
      }

      const embedder = new GoogleGenerativeAIEmbeddings({ apiKey: geminiApiKey });
      const queryEmbedding = await embedder.embedQuery(input);
      
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 15, // Retrieve more results for better context
        include: ["documents", "metadatas", "distances"]
      });

      const documents = results.documents?.[0] || [];
      if (documents.length === 0) {
        return { output: "No relevant information found in your uploaded documents for this query.", confidence: 0.5 };
      }

      // Step 2: Use an LLM to synthesize an answer from the retrieved chunks
      const retrievedContext = documents.map((doc, i) => `--- Document Chunk ${i+1} ---\n${doc}`).join('\n\n');
      
      const summarizationPrompt = `You are an expert document analyst. Your task is to answer the user's question based *only* on the provided document chunks.

**User's Question:**
"${input}"

**Retrieved Document Chunks:**
${retrievedContext}

**Instructions:**
1.  Carefully read the user's question and the document chunks.
2.  Synthesize a clear, concise, and direct answer to the question using only the information from the chunks.
3.  If the chunks do not contain enough information to answer the question, state that the information could not be found in the document.
4.  Do not make up information or use external knowledge.
5.  Answer in the same language as the user's question.
6.  Do not refer to the document chunks directly (e.g., "In chunk 3..."). Just provide the answer.

**Answer:**`;

      // Call the summarizer agent to process the context and generate a final answer
      const summaryResult = await callAgent("summarizer", summarizationPrompt, context);

      return {
        output: summaryResult.output,
        confidence: Math.min(0.95, (summaryResult.confidence || 0.8) + 0.1) // Boost confidence slightly
      };

    } catch (error) {
      logger.error(`Error in document_search agent for user ${userId}:`, error);
      return {
        output: `An error occurred while searching the document: ${error.message}`,
        confidence: 0.2
      };
    }
  }
});

console.log('Document Search agent registered successfully');
