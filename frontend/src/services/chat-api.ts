import axios from 'axios';

export interface SendMessagePayload {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

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