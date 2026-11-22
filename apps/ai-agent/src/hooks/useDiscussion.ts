import { useState, useCallback, useRef } from 'react';
import type { 
  DiscussionSession, 
  ConversationMessage, 
  ConsensusCheck,
  FinalConclusion 
} from '@/types';
import type { DiscussionEngine } from '@/services/discussionEngine';

export type DiscussionPhase = 
  | 'idle'
  | 'initializing'
  | 'discussing'
  | 'checking_consensus'
  | 'generating_conclusion'
  | 'completed'
  | 'error';

export interface DiscussionState {
  phase: DiscussionPhase;
  currentRound: number;
  messages: ConversationMessage[];
  lastConsensusCheck: ConsensusCheck | null;
  conclusion: FinalConclusion | null;
  error: string | null;
  typingAgents: string[];
}

export const useDiscussion = (
  engine: DiscussionEngine | null,
  session: DiscussionSession | null,
  onMessage: (message: ConversationMessage) => void,
  onComplete: (conclusion: FinalConclusion) => void
) => {
  const [state, setState] = useState<DiscussionState>({
    phase: 'idle',
    currentRound: 0,
    messages: [],
    lastConsensusCheck: null,
    conclusion: null,
    error: null,
    typingAgents: []
  });

  const abortRef = useRef(false);

  const startDiscussion = useCallback(async () => {
    if (!engine || !session) {
      setState(prev => ({ ...prev, error: '讨论引擎或会话未初始化' }));
      return;
    }

    abortRef.current = false;

    setState({
      phase: 'initializing',
      currentRound: 0,
      messages: [],
      lastConsensusCheck: null,
      conclusion: null,
      error: null,
      typingAgents: []
    });

    try {
      const generator = engine.runDiscussion(session);

      for await (const event of generator) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'message':
            if (event.data.status === 'typing') {
              setState(prev => ({
                ...prev,
                phase: 'discussing',
                currentRound: event.data.round,
                typingAgents: [...prev.typingAgents, event.data.agentId]
              }));
            } else if (event.data.message) {
              const message = event.data.message as ConversationMessage;
              setState(prev => ({
                ...prev,
                phase: 'discussing',
                currentRound: event.data.round,
                messages: [...prev.messages, message],
                typingAgents: prev.typingAgents.filter(id => id !== message.agentId)
              }));
              onMessage(message);
            }
            break;

          case 'consensus_check':
            setState(prev => ({
              ...prev,
              phase: 'checking_consensus',
              lastConsensusCheck: event.data as ConsensusCheck
            }));
            break;

          case 'conclusion':
            const conclusion = event.data as FinalConclusion;
            setState(prev => ({
              ...prev,
              phase: 'completed',
              conclusion,
              typingAgents: []
            }));
            onComplete(conclusion);
            break;

          case 'error':
            setState(prev => ({
              ...prev,
              phase: 'error',
              error: event.data.error || '未知错误',
              typingAgents: []
            }));
            break;
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: (error as Error).message,
        typingAgents: []
      }));
    }
  }, [engine, session, onMessage, onComplete]);

  const stopDiscussion = useCallback(() => {
    abortRef.current = true;
    setState(prev => ({
      ...prev,
      phase: 'idle',
      typingAgents: []
    }));
  }, []);

  const resetDiscussion = useCallback(() => {
    abortRef.current = true;
    setState({
      phase: 'idle',
      currentRound: 0,
      messages: [],
      lastConsensusCheck: null,
      conclusion: null,
      error: null,
      typingAgents: []
    });
  }, []);

  return {
    state,
    startDiscussion,
    stopDiscussion,
    resetDiscussion
  };
};
