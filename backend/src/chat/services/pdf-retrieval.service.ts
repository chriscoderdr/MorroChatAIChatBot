import { Injectable } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

@Injectable()
export class PdfRetrievalService {
  private chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

  async similaritySearch(userId: string, queryEmbedding: number[], k = 5) {
    const collectionName = `user_${userId}`;
    const collection = await this.chroma.getOrCreateCollection({ name: collectionName });
    // Chroma's query API: https://docs.trychroma.com/js_reference/classes/Collection#query
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: k,
    });
    return results;
  }
}
