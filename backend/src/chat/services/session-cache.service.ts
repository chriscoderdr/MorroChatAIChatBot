import { Injectable } from '@nestjs/common';
import { ChatSession } from '../schemas/chat-session.schema';

@Injectable()
export class SessionCacheService {
  private cache: Map<string, { 
    session: ChatSession; 
    timestamp: number;
    pendingMessages: any[];
  }> = new Map();
  
  private readonly TTL = 60 * 60 * 1000; // 1 hour in milliseconds

  getSession(sessionId: string): ChatSession | null {
    const entry = this.cache.get(sessionId);
    
    if (!entry) {
      return null;
    }
    
    // Check if the entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(sessionId);
      return null;
    }
    
    return entry.session;
  }
  
  setSession(sessionId: string, session: ChatSession): void {
    this.cache.set(sessionId, {
      session,
      timestamp: Date.now(),
      pendingMessages: [],
    });
  }
  
  addPendingMessage(sessionId: string, message: any): void {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.pendingMessages.push(message);
    }
  }
  
  getPendingMessages(sessionId: string): any[] {
    const entry = this.cache.get(sessionId);
    return entry ? [...entry.pendingMessages] : [];
  }
  
  clearPendingMessages(sessionId: string): void {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.pendingMessages = [];
    }
  }
  
  updateSessionMessages(sessionId: string, message: any): void {
    const entry = this.cache.get(sessionId);
    if (entry) {
      entry.session.messages.push(message);
      entry.timestamp = Date.now();
    }
  }
  
  // Invalidate the cache entry for a session
  invalidate(sessionId: string): void {
    this.cache.delete(sessionId);
  }
  
  // Clear expired cache entries
  cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(sessionId);
      }
    }
  }
  
  /**
   * Get all sessions for a specific user ID from the cache
   */
  getSessionsByUserId(userId: string): ChatSession[] {
    const sessions: ChatSession[] = [];
    
    // Filter cached sessions by userId
    for (const entry of this.cache.values()) {
      // Check if session is valid and belongs to the user
      if (
        entry.session.userId === userId && 
        (Date.now() - entry.timestamp <= this.TTL)
      ) {
        // Ensure updatedAt exists for sorting purposes
        if (!(entry.session as any).updatedAt) {
          (entry.session as any).updatedAt = entry.timestamp;
        }
        sessions.push(entry.session);
      }
    }
    
    return sessions;
  }
}
