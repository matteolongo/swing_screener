import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  ChatAnswerRequest,
  ChatAnswerResponse,
  ChatAnswerResponseAPI,
  toChatAnswerRequestAPI,
  transformChatAnswerResponse,
} from '@/features/chat/types';

export async function answerWorkspaceChat(request: ChatAnswerRequest): Promise<ChatAnswerResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.chatAnswer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toChatAnswerRequestAPI(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to answer workspace question');
  }
  const payload: ChatAnswerResponseAPI = await response.json();
  return transformChatAnswerResponse(payload);
}
