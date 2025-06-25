import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import * as pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

@Injectable()
export class PdfVectorService {
  private readonly logger = new Logger(PdfVectorService.name);
  private chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

  async vectorizeAndStorePdf(fileBuffer: Buffer, userId: string, message?: string) {
    // 1. Extract text from PDF
    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text;

    // 2. Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments([text]);

    // 3. Embed each chunk (Gemini)
    const embedder = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY });
    const vectors = await embedder.embedDocuments(docs.map(d => d.pageContent));

    // 4. Store in Chroma, namespaced by user
    const collectionName = `user_${userId}`;
    const collection = await this.chroma.getOrCreateCollection({ name: collectionName });

    await collection.add({
      ids: docs.map((_, i) => `${collectionName}_doc_${i}`),
      embeddings: vectors,
      metadatas: docs.map((doc, i) => ({
        chunk: i,
        message: message ?? '',
        source: 'pdf-upload',
      })),
      documents: docs.map(doc => doc.pageContent),
    });

    return { chunks: docs.length };
  }
}
