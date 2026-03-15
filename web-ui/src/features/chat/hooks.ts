import { useMutation } from '@tanstack/react-query';
import { answerWorkspaceChat } from '@/features/chat/api';
import type { ChatAnswerRequest, ChatAnswerResponse } from '@/features/chat/types';

export function useWorkspaceChatMutation() {
  return useMutation<ChatAnswerResponse, Error, ChatAnswerRequest>({
    mutationFn: (request) => answerWorkspaceChat(request),
  });
}
