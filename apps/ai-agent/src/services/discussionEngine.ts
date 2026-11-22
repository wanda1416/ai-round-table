import type { 
  DiscussionSession, 
  AIAgent, 
  AIProviderConfig,
  ConversationMessage,
  ConsensusCheck,
  FinalConclusion
} from '@/types';
import { createProvider } from './aiProvider';
import type { AIProvider } from './aiProvider';

// ==================== 讨论配置 ====================

export interface DiscussionConfig {
  maxRounds: number;
  consensusThreshold: number;
  maxAgentsPerRound: number;
  autoConclude: boolean;
}

// ==================== 讨论引擎 ====================

export class DiscussionEngine {
  private providers: Map<string, AIProvider> = new Map();
  private agents: Map<string, AIAgent> = new Map();
  private config: DiscussionConfig;

  constructor(
    providerConfigs: AIProviderConfig[],
    agents: AIAgent[],
    config: DiscussionConfig
  ) {
    // 初始化Providers
    for (const providerConfig of providerConfigs) {
      if (providerConfig.enabled) {
        this.providers.set(providerConfig.id, createProvider(providerConfig));
      }
    }

    // 初始化Agents
    for (const agent of agents) {
      if (agent.enabled) {
        this.agents.set(agent.id, agent);
      }
    }

    this.config = config;
  }

  // ==================== 核心讨论流程 ====================

  async *runDiscussion(
    session: DiscussionSession
  ): AsyncGenerator<{
    type: 'message' | 'consensus_check' | 'conclusion' | 'error';
    data: any;
  }> {
    try {
      const participantIds = session.participantIds.filter(id => 
        this.agents.has(id) && this.providers.has(this.agents.get(id)!.providerId)
      );

      if (participantIds.length < 2) {
        throw new Error('至少需要2个可用的AI Agent才能开始讨论');
      }

      let currentRound = 1;
      const messages: ConversationMessage[] = [...session.messages];

      // 第一轮：所有Agent依次回应用户问题
      for (const agentId of participantIds) {
        const agent = this.agents.get(agentId)!;
        const provider = this.providers.get(agent.providerId)!;

        yield { type: 'message', data: { round: currentRound, agentId, status: 'typing' } };

        try {
          const response = await provider.sendMessage(messages, agent);
          
          const message: ConversationMessage = {
            id: `msg_${Date.now()}_${agentId}`,
            role: 'assistant',
            content: response.content,
            agentId: agent.id,
            agentName: agent.name,
            timestamp: Date.now(),
            metadata: response.metadata
          };

          messages.push(message);
          yield { type: 'message', data: { round: currentRound, message } };
        } catch (error) {
          yield { 
            type: 'error', 
            data: { agentId, error: (error as Error).message } 
          };
        }
      }

      // 后续轮次：AI之间互相讨论
      while (currentRound < this.config.maxRounds) {
        currentRound++;

        // 选择本轮发言的Agent（策略：随机选择，避免总是同顺序）
        const speakers = this.selectSpeakersForRound(participantIds, currentRound);
        
        for (const agentId of speakers) {
          const agent = this.agents.get(agentId)!;
          const provider = this.providers.get(agent.providerId)!;

          yield { type: 'message', data: { round: currentRound, agentId, status: 'typing' } };

          try {
            const response = await provider.sendMessage(messages, agent);
            
            const message: ConversationMessage = {
              id: `msg_${Date.now()}_${agentId}_r${currentRound}`,
              role: 'assistant',
              content: response.content,
              agentId: agent.id,
              agentName: agent.name,
              timestamp: Date.now(),
              metadata: response.metadata
            };

            messages.push(message);
            yield { type: 'message', data: { round: currentRound, message } };
          } catch (error) {
            yield { 
              type: 'error', 
              data: { agentId, error: (error as Error).message } 
            };
          }
        }

        // 每两轮检测一次共识
        if (currentRound % 2 === 0 || currentRound >= this.config.maxRounds - 1) {
          const consensusCheck = await this.checkConsensus(messages, participantIds, currentRound);
          yield { type: 'consensus_check', data: consensusCheck };

          // 如果达成共识且配置允许，提前结束
          if (consensusCheck.reached && this.config.autoConclude && currentRound >= 3) {
            break;
          }
        }
      }

      // 生成最终结论
      const conclusion = await this.generateConclusion(messages, participantIds, session.topic);
      yield { type: 'conclusion', data: conclusion };

    } catch (error) {
      yield { type: 'error', data: { error: (error as Error).message } };
    }
  }

  // ==================== 发言者选择策略 ====================

  private selectSpeakersForRound(participantIds: string[], round: number): string[] {
    // 策略：第一轮所有人发言，后续轮次选择2-3人
    if (round === 1) {
      return participantIds;
    }

    // 随机选择2-3个Agent发言，确保不会总是同顺序
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
    const count = Math.min(
      2 + Math.floor(Math.random() * 2), // 2-3人
      this.config.maxAgentsPerRound
    );
    return shuffled.slice(0, count);
  }

  // ==================== 共识检测 ====================

  private async checkConsensus(
    messages: ConversationMessage[],
    participantIds: string[],
    round: number
  ): Promise<ConsensusCheck> {
    // 获取最近几轮的消息
    const recentMessages = messages.slice(-10);
    
    // 构建共识检测prompt
    const consensusPrompt = `作为中立的共识检测器，请分析以下AI讨论内容，判断各方是否达成共识。

讨论主题：${messages[0]?.content || '未知'}

最近对话：
${recentMessages.map(m => `${m.agentName}: ${m.content}`).join('\n\n')}

请分析并返回JSON格式：
{
  "reached": boolean, // 是否达成共识
  "confidence": number, // 置信度 0-100
  "agreementPoints": string[], // 共识要点
  "remainingDisagreements": string[], // 剩余分歧
  "agentStances": [ // 各方立场
    { "agentName": string, "stance": string, "keyPoints": string[], "confidence": number }
  ],
  "suggestedAction": "continue" | "conclude" | "need_more_info"
}`;

    // 使用第一个可用的provider来进行共识检测
    const firstAgentId = participantIds[0];
    const firstAgent = this.agents.get(firstAgentId)!;
    const firstProvider = this.providers.get(firstAgent.providerId)!;

    try {
      const response = await firstProvider.sendMessage(
        [{ 
          id: 'consensus_check', 
          role: 'user', 
          content: consensusPrompt, 
          timestamp: Date.now() 
        }],
        { ...firstAgent, systemPrompt: '你是一个中立的共识检测分析器。只返回JSON格式的分析结果，不要添加其他内容。' }
      );

      // 尝试解析JSON响应
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          round,
          checkedAt: Date.now(),
          reached: result.reached || false,
          confidence: result.confidence || 0,
          agreementPoints: result.agreementPoints || [],
          remainingDisagreements: result.remainingDisagreements || [],
          agentStances: result.agentStances || [],
          suggestedAction: result.suggestedAction || 'continue'
        };
      }
    } catch (error) {
      console.error('Consensus check error:', error);
    }

    // 如果解析失败，返回默认结果
    return {
      round,
      checkedAt: Date.now(),
      reached: false,
      confidence: 0,
      agreementPoints: [],
      remainingDisagreements: ['无法解析共识检测结果'],
      agentStances: [],
      suggestedAction: 'continue'
    };
  }

  // ==================== 生成最终结论 ====================

  private async generateConclusion(
    messages: ConversationMessage[],
    participantIds: string[],
    topic: string
  ): Promise<FinalConclusion> {
    const conclusionPrompt = `基于以下多AI讨论内容，生成一份综合性的最终结论报告。

讨论主题：${topic}

完整对话记录：
${messages.map(m => `${m.agentName}: ${m.content}`).join('\n\n')}

请生成一份结构化的结论报告，包含：
1. 核心结论（简洁明了）
2. 详细分析（深入阐述）
3. 关键要点（bullet points）
4. 各方贡献总结
5. 共识达成过程描述

返回JSON格式：
{
  "conclusion": string,
  "detailedAnalysis": string,
  "keyTakeaways": string[],
  "agentContributions": [
    { "agentName": string, "contribution": string, "keyInsight": string }
  ],
  "consensusProcess": string,
  "confidence": number
}`;

    const firstAgentId = participantIds[0];
    const firstAgent = this.agents.get(firstAgentId)!;
    const firstProvider = this.providers.get(firstAgent.providerId)!;

    try {
      const response = await firstProvider.sendMessage(
        [{ 
          id: 'conclusion', 
          role: 'user', 
          content: conclusionPrompt, 
          timestamp: Date.now() 
        }],
        { ...firstAgent, systemPrompt: '你是一个专业的结论总结器。只返回JSON格式的结论报告，不要添加其他内容。' }
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          sessionId: '', // 由调用者填充
          generatedAt: Date.now(),
          conclusion: result.conclusion || '未能生成结论',
          detailedAnalysis: result.detailedAnalysis || '',
          keyTakeaways: result.keyTakeaways || [],
          agentContributions: result.agentContributions || [],
          consensusProcess: result.consensusProcess || '',
          confidence: result.confidence || 0
        };
      }
    } catch (error) {
      console.error('Conclusion generation error:', error);
    }

    // 返回默认结论
    return {
      sessionId: '',
      generatedAt: Date.now(),
      conclusion: '由于技术原因，未能生成完整结论',
      detailedAnalysis: '',
      keyTakeaways: [],
      agentContributions: [],
      consensusProcess: '',
      confidence: 0
    };
  }
}
