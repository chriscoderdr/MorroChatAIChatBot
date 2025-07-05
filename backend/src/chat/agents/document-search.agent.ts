// document-search.agent.ts
import { Agent, AgentName } from '../types';
import { ChromaClient } from 'chromadb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Logger } from '@nestjs/common';
import { LanguageManager } from '../utils/language-utils';
import { ResponseFormatter } from '../utils/response-utils';

const logger = new Logger('DocumentSearchAgent');

export class DocumentSearchAgent implements Agent {
  public name: AgentName = 'document_search';
  public description =
    'Searches through user-uploaded documents to find specific information and provide a summarized answer.';
  public async handle(input, context, callAgent) {
    const { userId, geminiApiKey } = context;

    if (!userId) {
      return ResponseFormatter.formatErrorResponse(
        'Cannot search documents without a user session.',
        context,
        'document_search'
      );
    }
    if (!geminiApiKey) {
      return ResponseFormatter.formatErrorResponse(
        'Cannot search documents without a valid API key.',
        context,
        'document_search'
      );
    }

    try {
      // Step 1: Retrieve relevant document chunks from ChromaDB
      const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
      const chroma = new ChromaClient({ path: chromaUrl });
      const collectionName = `user_${userId}`;

      let collection;
      try {
        collection = await chroma.getCollection({ name: collectionName });
      } catch (error) {
        logger.warn(
          `ChromaDB collection '${collectionName}' not found or Chroma not available.`,
        );
        return ResponseFormatter.formatErrorResponse(
          'No documents found to search. Please upload a document first.',
          context,
          'document_search'
        );
      }

      const embedder = new GoogleGenerativeAIEmbeddings({
        apiKey: geminiApiKey,
      });
      const queryEmbedding = await embedder.embedQuery(input);

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 15, // Retrieve more results for better context
        include: ['documents', 'metadatas', 'distances'],
      });

      const documents = results.documents?.[0] || [];
      if (documents.length === 0) {
        return ResponseFormatter.formatAgentResponse(
          'No relevant information found in your uploaded documents for this query.',
          0.5
        );
      }

      // Step 2: Use an LLM to synthesize an answer from the retrieved chunks
      const retrievedContext = documents
        .map((doc, i) => `--- Document Chunk ${i + 1} ---\n${doc}`)
        .join('\n\n');

      // Get language context using our centralized utility
      let languageContext = { language: 'English', instructions: 'Please respond in the appropriate language.' };
      if (context.llm) {
        try {
          languageContext = await LanguageManager.getLanguageContext(input, context.llm, 'strict');
        } catch (e) {
          // fallback to English
          logger.warn('Failed to detect language, defaulting to English');
        }
      }
      
      const summarizationPrompt = `You are an expert document analyst. Your task is to answer the user's question based *only* on the provided document chunks.

${languageContext.instructions}

**User's Question:**
"${input}"

**Retrieved Document Chunks:**
${retrievedContext}

**Instructions:**
1.  Carefully read the user's question and the document chunks.
2.  Synthesize a clear, concise, and direct answer to the question using only the information from the chunks.
3.  If the chunks do not contain enough information to answer the question, state that the information could not be found in the document.
4.  Do not make up information or use external knowledge.
5.  Do not refer to the document chunks directly (e.g., "In chunk 3..."). Just provide the answer.

**Answer:**`;

      // Call the summarizer agent to process the context and generate a final answer
      if (!callAgent) {
        throw new Error('callAgent is not available');
      }
      const summaryResult = await callAgent(
        'summarizer',
        summarizationPrompt,
        context,
      );

      return ResponseFormatter.formatAgentResponse(
        summaryResult.output,
        Math.min(0.95, (summaryResult.confidence || 0.8) + 0.1) // Boost confidence slightly
      );
    } catch (error: any) {
      logger.error(`Error in document_search agent for user ${userId}:`, error);
      return ResponseFormatter.formatErrorResponse(
        `An error occurred while searching the document: ${error.message}`,
        context,
        'document_search'
      );
    }
  }
}
