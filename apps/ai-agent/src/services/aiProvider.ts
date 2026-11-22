import type { AIProviderConfig, AIAgent, ConversationMessage } from '@/types';

// ==================== AI Provider 接口 ====================

export interface AIProviderResponse {
  content: string;
  metadata?: {
    model: string;
    tokens?: number;
    latency: number;
  };
}

export interface AIProvider {
  config: AIProviderConfig;
  sendMessage(
    messages: ConversationMessage[],
    agent: AIAgent
  ): Promise<AIProviderResponse>;
}

// ==================== OpenAI Provider ====================

export class OpenAIProvider implements AIProvider {
  config: AIProviderConfig;
  
  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: ConversationMessage[],
    agent: AIAgent
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    const apiUrl = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
    
    // 构建消息历史，加入system prompt
    const apiMessages = [
      { role: 'system', content: agent.systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        content: data.choices[0].message.content,
        metadata: {
          model: data.model,
          tokens: data.usage?.total_tokens,
          latency
        }
      };
    } catch (error) {
      console.error('OpenAI Provider Error:', error);
      throw error;
    }
  }
}

// ==================== Anthropic (Claude) Provider ====================

export class AnthropicProvider implements AIProvider {
  config: AIProviderConfig;
  
  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: ConversationMessage[],
    agent: AIAgent
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    const apiUrl = this.config.baseUrl || 'https://api.anthropic.com/v1/messages';
    
    // 分离system message
    const systemMessage = agent.systemPrompt;
    const conversationMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 2000,
          system: systemMessage,
          messages: conversationMessages
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        content: data.content[0].text,
        metadata: {
          model: data.model,
          tokens: data.usage?.input_tokens + data.usage?.output_tokens,
          latency
        }
      };
    } catch (error) {
      console.error('Anthropic Provider Error:', error);
      throw error;
    }
  }
}

// ==================== Gemini Provider ====================

export class GeminiProvider implements AIProvider {
  config: AIProviderConfig;
  
  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: ConversationMessage[],
    agent: AIAgent
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();
    
    // Gemini API URL 格式
    const apiUrl = this.config.baseUrl || 
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`;

    // 构建对话历史
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    try {
      const response = await fetch(`${apiUrl}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: agent.systemPrompt }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        content: data.candidates[0].content.parts[0].text,
        metadata: {
          model: this.config.model,
          latency
        }
      };
    } catch (error) {
      console.error('Gemini Provider Error:', error);
      throw error;
    }
  }
}

// ==================== Provider 工厂 ====================

export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'custom':
      // 自定义provider使用OpenAI兼容格式
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
