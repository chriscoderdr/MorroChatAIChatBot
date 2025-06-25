import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import * as pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

@Injectable()
export class PdfVectorService {
  private readonly logger = new Logger(PdfVectorService.name);
  private chroma: ChromaClient;

  constructor() {
    // Parse CHROMA_URL for host, port, and ssl
    const url = new URL(process.env.CHROMA_URL || 'http://localhost:8000');
    const host = url.hostname;
    const port = Number(url.port) || 8000;
    const ssl = url.protocol === 'https:';
    this.chroma = new ChromaClient({ host, port, ssl });
  }

  async vectorizeAndStorePdf(fileBuffer: Buffer, userId: string, message?: string) {
    try {
      // 1. Extract text from PDF
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;

      // 2. Split text into chunks
      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      let docs = await splitter.createDocuments([text]);

      // Filter out empty/whitespace-only chunks
      docs = docs.filter(doc => doc.pageContent && doc.pageContent.trim().length > 0);
      if (docs.length === 0) {
        this.logger.warn('No valid (non-empty) chunks found in PDF.');
        return { chunks: 0, filtered: true };
      }

      // 3. Embed each chunk (Gemini)
      const embedder = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY });
      let vectors = await embedder.embedDocuments(docs.map(d => d.pageContent));

      // Filter out empty embeddings (Gemini sometimes returns empty arrays)
      const validEntries = docs.map((doc, i) => ({
        doc,
        vector: vectors[i],
        idx: i
      })).filter(entry => Array.isArray(entry.vector) && entry.vector.length > 0 && entry.vector.some(v => typeof v === 'number' && !isNaN(v)));

      if (validEntries.length === 0) {
        this.logger.warn('No valid embeddings returned from Gemini.');
        return { chunks: 0, filtered: true };
      }

      // 4. Store in Chroma, namespaced by user
      const collectionName = `user_${userId}`;
      const collection = await this.chroma.getOrCreateCollection({ name: collectionName });

      await collection.add({
        ids: validEntries.map((_, i) => `${collectionName}_doc_${validEntries[i].idx}`),
        embeddings: validEntries.map(entry => entry.vector),
        metadatas: validEntries.map((entry, i) => ({
          chunk: entry.idx,
          message: message ?? '',
          source: 'pdf-upload',
        })),
        documents: validEntries.map(entry => entry.doc.pageContent),
      });

      this.logger.log(`Stored ${validEntries.length} valid chunks for user ${userId}. Filtered out ${docs.length - validEntries.length} invalid chunks.`);
      return { chunks: validEntries.length, filtered: docs.length - validEntries.length };
    } catch (error) {
      this.logger.error('Error in vectorizeAndStorePdf:', error);
      throw error;
    }
  }
}
