// ==================== AI Provider 配置 ====================

export type AIProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  baseUrl?: string; // 自定义API地址（用于代理或自定义模型）
  model: string;
  enabled: boolean;
}

// ==================== AI Agent 定义 ====================

export interface AIAgent {
  id: string;
  name: string;
  providerId: string; // 关联的Provider
  avatar?: string;
  color: string;
  
  // 核心：System Prompt 定义了AI的"本心"和视角
  systemPrompt: string;
  
  // 个性特征（用于UI展示）
  personality: string;
  
  // 思考风格
  thinkingStyle: 'analytical' | 'intuitive' | 'critical' | 'creative' | 'balanced';
  
  // 是否启用
  enabled: boolean;
}

// ==================== 对话消息 ====================

export type MessageRole = 'system' | 'user' | 'assistant';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  agentId?: string; // assistant消息时必填
  agentName?: string;
  timestamp: number;
  
  // 元数据
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
  };
}

// ==================== 会话状态 ====================

export type SessionStatus = 
  | 'idle'           // 空闲
  | 'configuring'    // 配置中
  | 'ready'          // 准备就绪
  | 'discussing'     // 讨论中
  | 'checking'       // 检测共识中
  | 'concluding'     // 生成结论中
  | 'completed';     // 已完成

export interface DiscussionSession {
  id: string;
  topic: string;
  context?: string; // 用户提供的背景信息
  
  status: SessionStatus;
  
  // 参与讨论的Agent IDs
  participantIds: string[];
  
  // 对话历史（所有AI共享的上下文）
  messages: ConversationMessage[];
  
  // 当前轮次
  currentRound: number;
  maxRounds: number;
  
  // 创建时间
  createdAt: number;
  updatedAt: number;
}

// ==================== 共识检测 ====================

export interface ConsensusCheck {
  round: number;
  checkedAt: number;
  
  // 是否达成共识
  reached: boolean;
  
  // 共识程度 (0-100)
  confidence: number;
  
  // 核心共识点
  agreementPoints: string[];
  
  // 剩余分歧
  remainingDisagreements: string[];
  
  // 每个Agent的立场摘要
  agentStances: AgentStance[];
  
  // 建议的下一步
  suggestedAction: 'continue' | 'conclude' | 'need_more_info';
}

export interface AgentStance {
  agentId: string;
  agentName: string;
  stance: string; // 立场摘要
  keyPoints: string[]; // 关键观点
  confidence: number; // 置信度
}

// ==================== 最终结论 ====================

export interface FinalConclusion {
  sessionId: string;
  generatedAt: number;
  
  // 核心结论
  conclusion: string;
  
  // 详细分析
  detailedAnalysis: string;
  
  // 关键要点
  keyTakeaways: string[];
  
  // 各方贡献
  agentContributions: AgentContribution[];
  
  // 共识达成过程
  consensusProcess: string;
  
  // 置信度
  confidence: number;
}

export interface AgentContribution {
  agentId: string;
  agentName: string;
  contribution: string;
  keyInsight: string;
}

// ==================== 应用状态 ====================

export interface AppState {
  // 配置的Providers
  providers: AIProviderConfig[];
  
  // 配置的Agents
  agents: AIAgent[];
  
  // 当前会话
  currentSession: DiscussionSession | null;
  
  // 历史会话
  sessionHistory: DiscussionSession[];
  
  // 设置
  settings: AppSettings;
}

export interface AppSettings {
  defaultMaxRounds: number;
  autoCheckConsensus: boolean;
  consensusThreshold: number; // 共识阈值 (0-100)
  language: 'zh' | 'en';
}
