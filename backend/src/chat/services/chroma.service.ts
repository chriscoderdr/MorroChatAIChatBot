import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly chroma: ChromaClient;

  constructor() {
    const chromaUrl = process.env.CHROMA_URL || '';
    let host = '';
    let port = 8000;
    let ssl = false;
    try {
      const url = new URL(chromaUrl);
      host = url.hostname;
      port = Number(url.port) || 8000;
      ssl = url.protocol === 'https:';
    } catch (err) {
      this.logger.error(`Failed to parse CHROMA_URL: ${chromaUrl}`, err);
    }
    this.chroma = new ChromaClient({ host, port, ssl });
  }

  getClient(): ChromaClient {
    return this.chroma;
  }
}
