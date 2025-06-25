import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly chroma: ChromaClient;

  constructor() {
    const chromaUrl = process.env.CHROMA_URL || "";
    this.logger.debug(`CHROMA_URL: ${chromaUrl}`);
    let host = '';
    let port = 8000;
    let ssl = false;
    try {
      const url = new URL(chromaUrl);
      host = url.hostname;
      port = Number(url.port) || 8000;
      ssl = url.protocol === 'https:';
      this.logger.debug(`Parsed Chroma host: ${host}, port: ${port}, ssl: ${ssl}`);
    } catch (err) {
      this.logger.error(`Failed to parse CHROMA_URL: ${chromaUrl}`, err);
    }
    this.logger.debug(`Attempting to connect to ChromaClient with host=${host}, port=${port}, ssl=${ssl}`);
    this.chroma = new ChromaClient({ host, port, ssl });
  }

  getClient(): ChromaClient {
    return this.chroma;
  }
}
