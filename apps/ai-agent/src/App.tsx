import { useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { useAppState } from '@/hooks/useAppState';
import { useDiscussion } from '@/hooks/useDiscussion';
import { DiscussionEngine } from '@/services/discussionEngine';
import type { DiscussionConfig } from '@/services/discussionEngine';

import { ProviderConfig } from '@/sections/ProviderConfig';
import { AgentConfig } from '@/sections/AgentConfig';
import { DiscussionPanel } from '@/sections/DiscussionPanel';

import { 
  Settings, 
  Bot, 
  MessageSquare,
  Brain
} from 'lucide-react';

function App() {
  const {
    state,
    addProvider,
    updateProvider,
    removeProvider,
    addAgent,
    updateAgent,
    removeAgent,
    createSession,
    addMessageToSession,
    completeSession,
    clearCurrentSession
  } = useAppState();

  // 创建讨论引擎
  const discussionEngine = useMemo(() => {
    const enabledProviders = state.providers.filter(p => p.enabled);
    const enabledAgents = state.agents.filter(a => a.enabled);
    
    if (enabledProviders.length === 0 || enabledAgents.length < 2) {
      return null;
    }

    const config: DiscussionConfig = {
      maxRounds: state.settings.defaultMaxRounds,
      consensusThreshold: state.settings.consensusThreshold,
      maxAgentsPerRound: 3,
      autoConclude: state.settings.autoCheckConsensus
    };

    return new DiscussionEngine(enabledProviders, enabledAgents, config);
  }, [state.providers, state.agents, state.settings]);

  // 讨论状态管理
  const handleMessage = useCallback((message: any) => {
    addMessageToSession(message);
  }, [addMessageToSession]);

  const handleComplete = useCallback((conclusion: any) => {
    completeSession(conclusion);
    toast.success('讨论已完成，结论已生成！');
  }, [completeSession]);

  const {
    state: discussionState,
    startDiscussion,
    stopDiscussion,
    resetDiscussion
  } = useDiscussion(
    discussionEngine,
    state.currentSession,
    handleMessage,
    handleComplete
  );

  // 开始讨论
  const handleStartDiscussion = useCallback((topic: string, context: string, participantIds: string[]) => {
    if (!discussionEngine) {
      toast.error('请先配置至少2个AI Agent');
      return;
    }

    createSession(topic, context, participantIds);
    
    // 延迟一下让session创建完成
    setTimeout(() => {
      startDiscussion();
    }, 100);
  }, [discussionEngine, createSession, startDiscussion]);

  // 检查配置状态
  const configStatus = useMemo(() => {
    const providerCount = state.providers.filter(p => p.enabled).length;
    const agentCount = state.agents.filter(a => a.enabled).length;
    
    return {
      hasProvider: providerCount > 0,
      hasEnoughAgents: agentCount >= 2,
      providerCount,
      agentCount
    };
  }, [state.providers, state.agents]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                多AI共识协作系统
              </h1>
              <p className="text-xs text-gray-500">
                让多个独立AI进行真实对话并达成共识
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${configStatus.hasProvider ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-600">
                {configStatus.providerCount} 个Provider
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${configStatus.hasEnoughAgents ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-600">
                {configStatus.agentCount} 个Agent
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!configStatus.hasProvider ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <Settings className="w-6 h-6 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800">欢迎使用多AI共识协作系统</h3>
                  <p className="text-amber-700 mt-1">
                    首先，你需要配置至少一个AI Provider（OpenAI、Claude、Gemini等）。
                    你的API Key只会保存在本地浏览器中，不会上传到任何服务器。
                  </p>
                </div>
              </div>
            </div>
            <ProviderConfig
              providers={state.providers}
              onAdd={addProvider}
              onUpdate={updateProvider}
              onRemove={removeProvider}
            />
          </div>
        ) : !configStatus.hasEnoughAgents ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <Bot className="w-6 h-6 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800">配置AI Agent</h3>
                  <p className="text-amber-700 mt-1">
                    你已配置了 {configStatus.providerCount} 个Provider。
                    现在需要创建至少2个AI Agent才能开始讨论。
                    每个Agent应该有独立的视角和System Prompt。
                  </p>
                </div>
              </div>
            </div>
            <Tabs defaultValue="agents">
              <TabsList className="mb-4">
                <TabsTrigger value="agents">
                  <Bot className="w-4 h-4 mr-1" />
                  AI Agent
                </TabsTrigger>
                <TabsTrigger value="providers">
                  <Settings className="w-4 h-4 mr-1" />
                  Providers
                </TabsTrigger>
              </TabsList>
              <TabsContent value="agents">
                <AgentConfig
                  agents={state.agents}
                  providers={state.providers}
                  onAdd={addAgent}
                  onUpdate={updateAgent}
                  onRemove={removeAgent}
                />
              </TabsContent>
              <TabsContent value="providers">
                <ProviderConfig
                  providers={state.providers}
                  onAdd={addProvider}
                  onUpdate={updateProvider}
                  onRemove={removeProvider}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Tabs defaultValue="discuss" className="h-[calc(100vh-12rem)]">
            <TabsList className="mb-4">
              <TabsTrigger value="discuss">
                <MessageSquare className="w-4 h-4 mr-1" />
                讨论
              </TabsTrigger>
              <TabsTrigger value="agents">
                <Bot className="w-4 h-4 mr-1" />
                AI Agent ({state.agents.filter(a => a.enabled).length})
              </TabsTrigger>
              <TabsTrigger value="providers">
                <Settings className="w-4 h-4 mr-1" />
                Providers ({state.providers.filter(p => p.enabled).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discuss" className="h-full">
              <div className="h-full">
                <DiscussionPanel
                  agents={state.agents}
                  session={state.currentSession}
                  discussionState={discussionState}
                  onStartDiscussion={handleStartDiscussion}
                  onStopDiscussion={stopDiscussion}
                  onResetDiscussion={() => {
                    resetDiscussion();
                    clearCurrentSession();
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="agents">
              <AgentConfig
                agents={state.agents}
                providers={state.providers}
                onAdd={addAgent}
                onUpdate={updateAgent}
                onRemove={removeAgent}
              />
            </TabsContent>

            <TabsContent value="providers">
              <ProviderConfig
                providers={state.providers}
                onAdd={addProvider}
                onUpdate={updateProvider}
                onRemove={removeProvider}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>多AI共识协作系统 - 让多个独立AI进行真实对话并达成共识</p>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}

export default App;
