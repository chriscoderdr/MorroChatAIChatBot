import type { AxiosProgressEvent } from 'axios';
import type { ChatHistory, ChatMessage } from '../models/chatMessage';
import axios from 'axios';
export type { UploadPdfResponse } from '../dtos/upload-pdf-response-dto';
export type { NewChatResponse } from '../dtos/new-chat-response-dto';
export type { SendMessagePayload } from '../dtos/send-message-payload-dto';
export type { ChatResponse } from '../dtos/chat-response-dto';

import type { UploadPdfResponse } from '../dtos/upload-pdf-response-dto';
import type { NewChatResponse } from '../dtos/new-chat-response-dto';
import type { SendMessagePayload } from '../dtos/send-message-payload-dto';
import type { ChatResponse } from '../dtos/chat-response-dto';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This enables sending cookies with cross-origin requests
});

export const uploadPdfWithMessageApi = async (
  file: File,
  message: string,
  onUploadProgress?: (percent: number) => void
): Promise<UploadPdfResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('message', message);
  const config = {
    headers: { 'Content-Type': 'multipart/form-data' },
    withCredentials: true,
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onUploadProgress) onUploadProgress(percent);
      }
    },
  };
  const response = await apiClient.post<UploadPdfResponse>('/chat/upload', formData, config);
  return response.data;
};


export const startNewChat = async (): Promise<NewChatResponse> => {
  try {
    const response = await apiClient.post<NewChatResponse>('/chat/new');
    return response.data;
  } catch (error: any) {
    if (error && error.response && error.response.data && error.response.data.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Failed to start new chat session');
  }
};

export const sendMessage = async (payload: SendMessagePayload): Promise<ChatResponse> => {
  try {
    const response = await apiClient.post<ChatResponse>('/chat', payload);

    await new Promise(resolve => setTimeout(resolve, 500));
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle Axios-specific errors
      console.error('Error sending message:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get a response from the server.');
    }
    // Handle generic errors
    console.error('An unexpected error occurred:', error);
    throw new Error('An unexpected error occurred.');
  }
};

export const fetchChatHistory = async (): Promise<ChatHistory> => {
  try {
    const response = await apiClient.get<ChatMessage[]>('/chat/history');
    // The backend now returns an array of { type, data } objects
    const messages = response.data;
    const chatHistory: ChatHistory = {
      sessionId: 'current-session',
      messages,
      hasMessages: messages.length > 0
    };
    return chatHistory;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error fetching chat history:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch chat history from the server.');
    }
    console.error('An unexpected error occurred:', error);
    throw new Error('An unexpected error occurred while fetching chat history.');
  }
};