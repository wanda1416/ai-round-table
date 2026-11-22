import { useState, useCallback, useEffect } from 'react';
import type { 
  AppState, 
  AIProviderConfig, 
  AIAgent, 
  DiscussionSession,
  AppSettings 
} from '@/types';

// 默认设置
const defaultSettings: AppSettings = {
  defaultMaxRounds: 5,
  autoCheckConsensus: true,
  consensusThreshold: 75,
  language: 'zh'
};

// 预设的Agent配置（使用同一个模型时，通过不同system prompt区分身份）
const defaultAgents: AIAgent[] = [
  {
    id: 'agent_1',
    name: '分析者',
    providerId: '',
    color: '#3b82f6',
    systemPrompt: `你是一位严谨的分析者。在讨论中，你应该：
- 注重事实和逻辑，基于已有信息进行分析
- 提出具体的数据和证据支持你的观点
- 识别问题中的关键因素和变量
- 保持客观理性的态度
- 在与其他AI讨论时，认真考虑他们的观点，如果更有说服力，愿意调整立场
你的目标是帮助团队达成准确、可靠的结论。`,
    personality: '理性、严谨、注重事实',
    thinkingStyle: 'analytical',
    enabled: true
  },
  {
    id: 'agent_2',
    name: '质疑者',
    providerId: '',
    color: '#ef4444',
    systemPrompt: `你是一位善于质疑的思考者。在讨论中，你应该：
- 对提出的观点保持健康的怀疑态度
- 找出论证中的漏洞和假设
- 提出"如果...会怎样"的反事实问题
- 挑战共识，确保结论经得起检验
- 在与其他AI讨论时，你的质疑应该建设性，目的是完善结论而非赢辩论
你的目标是帮助团队发现盲点，避免草率结论。`,
    personality: '尖锐、质疑、善于发现漏洞',
    thinkingStyle: 'critical',
    enabled: true
  },
  {
    id: 'agent_3',
    name: '整合者',
    providerId: '',
    color: '#10b981',
    systemPrompt: `你是一位擅长整合的思考者。在讨论中，你应该：
- 寻找不同观点之间的共同点和联系
- 调和看似矛盾的观点
- 提出综合性的解决方案
- 关注整体图景和长期影响
- 在与其他AI讨论时，努力理解各方立场，促进共识形成
你的目标是帮助团队找到平衡、可持续的结论。`,
    personality: '平衡、调和、寻找共同点',
    thinkingStyle: 'balanced',
    enabled: true
  }
];

// 从localStorage加载状态
const loadStateFromStorage = (): Partial<AppState> => {
  try {
    const saved = localStorage.getItem('multi_ai_discussion_state');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return {};
};

// 保存状态到localStorage
const saveStateToStorage = (state: AppState) => {
  try {
    // 不保存API key到localStorage（安全考虑）
    const stateToSave = {
      ...state,
      providers: state.providers.map(p => ({ ...p, apiKey: '' }))
    };
    localStorage.setItem('multi_ai_discussion_state', JSON.stringify(stateToSave));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
};

export const useAppState = () => {
  const savedState = loadStateFromStorage();

  const [state, setState] = useState<AppState>({
    providers: savedState.providers || [],
    agents: savedState.agents || defaultAgents,
    currentSession: null,
    sessionHistory: savedState.sessionHistory || [],
    settings: savedState.settings || defaultSettings
  });

  // 自动保存状态
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // ==================== Provider 管理 ====================

  const addProvider = useCallback((provider: Omit<AIProviderConfig, 'id'>) => {
    const newProvider: AIProviderConfig = {
      ...provider,
      id: `provider_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      providers: [...prev.providers, newProvider]
    }));
    return newProvider.id;
  }, []);

  const updateProvider = useCallback((id: string, updates: Partial<AIProviderConfig>) => {
    setState(prev => ({
      ...prev,
      providers: prev.providers.map(p => 
        p.id === id ? { ...p, ...updates } : p
      )
    }));
  }, []);

  const removeProvider = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      providers: prev.providers.filter(p => p.id !== id),
      // 同时更新关联的agents
      agents: prev.agents.map(a => 
        a.providerId === id ? { ...a, providerId: '', enabled: false } : a
      )
    }));
  }, []);

  // ==================== Agent 管理 ====================

  const addAgent = useCallback((agent: Omit<AIAgent, 'id'>) => {
    const newAgent: AIAgent = {
      ...agent,
      id: `agent_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      agents: [...prev.agents, newAgent]
    }));
    return newAgent.id;
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<AIAgent>) => {
    setState(prev => ({
      ...prev,
      agents: prev.agents.map(a => 
        a.id === id ? { ...a, ...updates } : a
      )
    }));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      agents: prev.agents.filter(a => a.id !== id)
    }));
  }, []);

  // ==================== Session 管理 ====================

  const createSession = useCallback((
    topic: string, 
    context: string,
    participantIds: string[]
  ): DiscussionSession => {
    const session: DiscussionSession = {
      id: `session_${Date.now()}`,
      topic,
      context,
      status: 'ready',
      participantIds,
      messages: context ? [
        {
          id: `ctx_${Date.now()}`,
          role: 'system',
          content: `讨论背景信息：${context}`,
          timestamp: Date.now()
        }
      ] : [],
      currentRound: 0,
      maxRounds: state.settings.defaultMaxRounds,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setState(prev => ({
      ...prev,
      currentSession: session
    }));

    return session;
  }, [state.settings.defaultMaxRounds]);

  const updateSession = useCallback((updates: Partial<DiscussionSession>) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      const updated = { 
        ...prev.currentSession, 
        ...updates,
        updatedAt: Date.now()
      };
      return {
        ...prev,
        currentSession: updated
      };
    });
  }, []);

  const addMessageToSession = useCallback((message: DiscussionSession['messages'][0]) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          messages: [...prev.currentSession.messages, message],
          updatedAt: Date.now()
        }
      };
    });
  }, []);

  const completeSession = useCallback((conclusion: any) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      const completedSession = {
        ...prev.currentSession,
        status: 'completed' as const,
        conclusion,
        updatedAt: Date.now()
      };
      return {
        ...prev,
        currentSession: null,
        sessionHistory: [completedSession, ...prev.sessionHistory]
      };
    });
  }, []);

  const clearCurrentSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSession: null
    }));
  }, []);

  // ==================== 设置管理 ====================

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, []);

  return {
    state,
    // Provider操作
    addProvider,
    updateProvider,
    removeProvider,
    // Agent操作
    addAgent,
    updateAgent,
    removeAgent,
    // Session操作
    createSession,
    updateSession,
    addMessageToSession,
    completeSession,
    clearCurrentSession,
    // 设置
    updateSettings
  };
};
