import { Injectable, Logger } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import * as pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

@Injectable()
export class PdfVectorService {
  private readonly logger = new Logger(PdfVectorService.name);
  private chroma;

  constructor(private readonly chromaService: ChromaService) {
    this.chroma = this.chromaService.getClient();
  }

  async vectorizeAndStorePdf(fileBuffer: Buffer, userId: string, message?: string) {
    try {
      // 1. Extract text from PDF with enhanced error handling
      let text: string;
      try {
        const pdfData = await pdfParse(fileBuffer, {
          // Add options to handle problematic PDFs
          max: 0, // Parse all pages
          pagerender: undefined, // Use default page render
          normalizeWhitespace: false,
          disableCombineTextItems: false
        });
        text = pdfData.text;
        this.logger.log(`PDF parsed successfully. Text length: ${text.length} characters`);
        this.logger.log(`First 200 characters: "${text.substring(0, 200)}..."`);
        this.logger.log(`Last 200 characters: "...${text.substring(Math.max(0, text.length - 200))}"`);
      } catch (pdfError) {
        this.logger.warn(`Standard PDF parsing failed: ${pdfError.message}`);
        
        // Try alternative parsing with more lenient options
        try {
          const pdfData = await pdfParse(fileBuffer, {
            max: 0,
            pagerender: undefined,
            normalizeWhitespace: true,
            disableCombineTextItems: true,
            // More lenient parsing options
            verbosity: 0,
            version: 'v1.10.100'
          });
          text = pdfData.text;
          this.logger.log(`PDF parsed with lenient options. Text length: ${text.length} characters`);
        } catch (fallbackError) {
          this.logger.error(`Both PDF parsing attempts failed. Standard: ${pdfError.message}, Fallback: ${fallbackError.message}`);
          
          // Check if the buffer is actually a PDF
          const pdfHeader = fileBuffer.slice(0, 5).toString();
          if (!pdfHeader.startsWith('%PDF')) {
            throw new Error('File is not a valid PDF. Please upload a valid PDF file.');
          }
          
          // Try one more time with minimal options
          try {
            const pdfData = await pdfParse(fileBuffer, { max: 10 }); // Limit to first 10 pages
            text = pdfData.text;
            this.logger.log(`PDF parsed with limited pages. Text length: ${text.length} characters`);
          } catch (finalError) {
            throw new Error(`Invalid PDF structure or corrupted file. Unable to extract text from PDF: ${finalError.message}`);
          }
        }
      }

      // Validate extracted text
      if (!text || text.trim().length === 0) {
        throw new Error('PDF appears to be empty or contains no extractable text.');
      }

      // 2. Enhanced chunking strategy for better semantic coherence
      const splitter = new RecursiveCharacterTextSplitter({ 
        chunkSize: 2000, // Increased chunk size for better context preservation
        chunkOverlap: 400, // Larger overlap to maintain context continuity
        separators: [
          '\n\n\n',   // Multiple line breaks (section separators)
          '\n\n',     // Paragraph breaks
          '. \n',     // Sentence + line break combination
          '.\n',      // Period + newline
          '\n',       // Line breaks
          '. ',       // Sentence endings
          '? ',       // Question endings
          '! ',       // Exclamation endings
          '; ',       // Semicolon breaks
          ', ',       // Comma breaks
          ' ',        // Word breaks
          ''          // Character breaks (fallback)
        ]
      });
      
      // Pre-process text to better preserve structure
      const preprocessedText = this.preprocessTextForChunking(text);
      this.logger.log(`Text preprocessed. Original length: ${text.length}, Preprocessed length: ${preprocessedText.length}`);
      
      let docs = await splitter.createDocuments([preprocessedText]);
      this.logger.log(`Initial chunks created: ${docs.length}`);

      // Post-process chunks for better semantic coherence
      docs = this.postProcessChunks(docs);
      this.logger.log(`After post-processing: ${docs.length} chunks`);

      // Filter out empty/whitespace-only chunks and very short chunks
      const originalCount = docs.length;
      const filteredDocs = docs.filter((doc, index) => {
        const content = doc.pageContent && doc.pageContent.trim();
        const isValid = content && content.length > 50; // Reduced from 100 to 50 to be less restrictive
        
        if (!isValid) {
          this.logger.debug(`Filtered out chunk ${index}: length=${content ? content.length : 0}, preview="${content ? content.substring(0, 50) : 'empty'}"`);
        }
        
        return isValid;
      });
      
      docs = filteredDocs;
      this.logger.log(`After filtering (min 50 chars): ${docs.length} chunks (filtered out ${originalCount - docs.length})`);
      
      // Log chunk size distribution
      if (docs.length > 0) {
        const chunkSizes = docs.map(doc => doc.pageContent.length);
        const avgChunkSize = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;
        const minChunkSize = Math.min(...chunkSizes);
        const maxChunkSize = Math.max(...chunkSizes);
        this.logger.log(`Chunk size stats: avg=${Math.round(avgChunkSize)}, min=${minChunkSize}, max=${maxChunkSize}`);
        
        // Log first few chunk previews
        docs.slice(0, 3).forEach((doc, i) => {
          this.logger.log(`Chunk ${i} preview (${doc.pageContent.length} chars): "${doc.pageContent.substring(0, 100)}..."`);
        });
      }
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
        ids: validEntries.map((_, i) => `${collectionName}_doc_${Date.now()}_${validEntries[i].idx}`),
        embeddings: validEntries.map(entry => entry.vector),
        metadatas: validEntries.map((entry, i) => ({
          chunk: entry.idx,
          message: message ?? '',
          source: 'pdf-upload',
          length: entry.doc.pageContent.length,
          timestamp: Date.now(),
          // Enhanced metadata for better retrieval
          preview: entry.doc.pageContent.substring(0, 150),
          wordCount: entry.doc.metadata?.wordCount || entry.doc.pageContent.split(/\s+/).length,
          hasNumbers: entry.doc.metadata?.hasNumbers || /\d+/.test(entry.doc.pageContent),
          hasArticleReference: entry.doc.metadata?.hasArticleReference || /article\s+\d+|artículo\s+\d+/i.test(entry.doc.pageContent),
          startsWithHeader: entry.doc.metadata?.startsWithHeader || false,
          chunkIndex: entry.doc.metadata?.chunkIndex || entry.idx,
          // Extract key terms for better matching - convert array to string
          keyTerms: this.extractKeyTerms(entry.doc.pageContent).join(','),
          // Detect content type
          contentType: this.detectContentType(entry.doc.pageContent)
        })),
        documents: validEntries.map(entry => entry.doc.pageContent),
      });

      this.logger.log(`Successfully stored ${validEntries.length} chunks in ChromaDB collection: ${collectionName}`);
      this.logger.log(`Total characters stored: ${validEntries.reduce((sum, entry) => sum + entry.doc.pageContent.length, 0)}`);

      return { chunks: validEntries.length, filtered: docs.length - validEntries.length };
    } catch (error) {
      this.logger.error('Error in vectorizeAndStorePdf:', error);
      throw error;
    }
  }

  /**
   * Preprocesses text to better preserve document structure for chunking
   */
  private preprocessTextForChunking(text: string): string {
    let processed = text;
    
    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Preserve article/section numbering by adding extra spacing
    processed = processed.replace(/(\n)(Article\s+\d+|Artículo\s+\d+|Section\s+\d+|Sección\s+\d+|Chapter\s+\d+|Capítulo\s+\d+)/gi, '\n\n\n$2');
    
    // Preserve title case headers (likely to be important sections)
    processed = processed.replace(/(\n)([A-Z][A-Z\s]{10,})/g, '\n\n\n$2');
    
    // Add spacing before numbered lists to keep them together
    processed = processed.replace(/(\n)(\d+[\.\)])/g, '\n\n$2');
    
    // Preserve bullet points and lists
    processed = processed.replace(/(\n)([-•*]\s)/g, '\n\n$2');
    
    // Clean up excessive whitespace while preserving intentional spacing
    processed = processed.replace(/\n{4,}/g, '\n\n\n');
    
    return processed;
  }

  /**
   * Post-processes chunks to improve semantic coherence
   */
  private postProcessChunks(docs: any[]): any[] {
    const processedDocs: any[] = [];
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      let content = doc.pageContent;
      
      // If chunk starts with incomplete sentence, try to merge with previous chunk's ending
      if (i > 0 && this.startsWithIncompleteThought(content)) {
        const prevDoc = processedDocs[processedDocs.length - 1];
        if (prevDoc && this.canMergeChunks(prevDoc.pageContent, content)) {
          const mergedContent = this.mergeChunks(prevDoc.pageContent, content);
          if (mergedContent.length <= 2500) { // Don't exceed reasonable size
            prevDoc.pageContent = mergedContent;
            continue; // Skip adding this chunk separately
          }
        }
      }
      
      // Clean up chunk content
      content = this.cleanChunkContent(content);
      
      // Add enhanced metadata
      doc.metadata = {
        ...doc.metadata,
        chunkIndex: i,
        wordCount: content.split(/\s+/).length,
        hasNumbers: /\d+/.test(content),
        hasArticleReference: /article\s+\d+|artículo\s+\d+/i.test(content),
        startsWithHeader: this.startsWithHeader(content)
      };
      
      doc.pageContent = content;
      processedDocs.push(doc);
    }
    
    return processedDocs;
  }

  /**
   * Checks if content starts with an incomplete thought
   */
  private startsWithIncompleteThought(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return false;
    
    // Check if starts with lowercase (likely continuation)
    const firstChar = trimmed[0];
    if (firstChar === firstChar.toLowerCase() && /[a-z]/.test(firstChar)) {
      return true;
    }
    
    // Check for common continuation patterns
    const continuationPatterns = [
      /^(and|or|but|however|therefore|thus|moreover|furthermore|additionally)/i,
      /^(que|y|o|pero|sin embargo|por lo tanto|además)/i
    ];
    
    return continuationPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Checks if two chunks can be safely merged
   */
  private canMergeChunks(chunk1: string, chunk2: string): boolean {
    const combined = chunk1 + ' ' + chunk2;
    return combined.length <= 2500 && 
           !this.startsWithHeader(chunk2) &&
           !this.hasStrongSectionBreak(chunk1, chunk2);
  }

  /**
   * Merges two chunks intelligently
   */
  private mergeChunks(chunk1: string, chunk2: string): string {
    const trimmed1 = chunk1.trim();
    const trimmed2 = chunk2.trim();
    
    // Smart joining based on context
    if (trimmed1.endsWith('.') || trimmed1.endsWith('!') || trimmed1.endsWith('?')) {
      return trimmed1 + ' ' + trimmed2;
    } else {
      return trimmed1 + ' ' + trimmed2;
    }
  }

  /**
   * Cleans up chunk content
   */
  private cleanChunkContent(content: string): string {
    // Remove excessive whitespace
    content = content.replace(/\s{3,}/g, ' ');
    
    // Clean up line breaks
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // Ensure proper spacing around punctuation
    content = content.replace(/([.!?])(\w)/g, '$1 $2');
    
    return content.trim();
  }

  /**
   * Checks if content starts with a header/title
   */
  private startsWithHeader(content: string): boolean {
    const trimmed = content.trim();
    const firstLine = trimmed.split('\n')[0];
    
    // Check for article/section patterns
    if (/^(Article\s+\d+|Artículo\s+\d+|Section\s+\d+|Chapter\s+\d+)/i.test(firstLine)) {
      return true;
    }
    
    // Check for all caps (likely headers)
    if (firstLine.length > 5 && firstLine === firstLine.toUpperCase() && /[A-Z]/.test(firstLine)) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if there's a strong section break between chunks
   */
  private hasStrongSectionBreak(chunk1: string, chunk2: string): boolean {
    const end1 = chunk1.trim().slice(-100);
    const start2 = chunk2.trim().slice(0, 100);
    
    // Look for chapter/section boundaries
    return /CHAPTER|SECTION|ARTICLE|TÍTULO|CAPÍTULO|SECCIÓN|ARTÍCULO/i.test(start2) ||
           /\n\n\n/.test(end1 + start2);
  }

  /**
   * Extracts key terms from content for better matching
   */
  private extractKeyTerms(content: string): string[] {
    const text = content.toLowerCase();
    const keyTerms: string[] = [];
    
    // Extract article/section references
    const articleMatches = text.match(/artículo\s+\d+|article\s+\d+/g);
    if (articleMatches) {
      keyTerms.push(...articleMatches);
    }
    
    // Extract important constitutional terms (for legal documents)
    const legalTerms = [
      'constitución', 'constitution', 'derechos', 'rights', 'libertad', 'freedom',
      'justicia', 'justice', 'estado', 'state', 'gobierno', 'government',
      'ley', 'law', 'tribunal', 'court', 'poder', 'power', 'autoridad', 'authority'
    ];
    
    legalTerms.forEach(term => {
      if (text.includes(term)) {
        keyTerms.push(term);
      }
    });
    
    // Extract capitalized words (likely important terms)
    const capitalizedWords = content.match(/\b[A-Z][a-z]+\b/g);
    if (capitalizedWords) {
      const filtered = capitalizedWords
        .filter(word => word.length > 3)
        .slice(0, 5); // Limit to top 5
      keyTerms.push(...filtered.map(w => w.toLowerCase()));
    }
    
    return [...new Set(keyTerms)]; // Remove duplicates
  }

  /**
   * Detects the type of content in a chunk
   */
  private detectContentType(content: string): string {
    const text = content.toLowerCase();
    
    if (/artículo\s+\d+|article\s+\d+/.test(text)) {
      return 'article';
    }
    
    if (/capítulo\s+\d+|chapter\s+\d+|título\s+\d+|title\s+\d+/.test(text)) {
      return 'chapter';
    }
    
    if (/^\s*\d+[\.\)]\s/.test(content)) {
      return 'numbered_list';
    }
    
    if (/^[A-Z\s]{10,}$/m.test(content)) {
      return 'header';
    }
    
    if (text.includes('definición') || text.includes('definition')) {
      return 'definition';
    }
    
    if (text.includes('procedimiento') || text.includes('procedure')) {
      return 'procedure';
    }
    
    return 'general';
  }
}
