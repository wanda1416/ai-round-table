import { useState, useRef, useEffect } from 'react';
import type { DiscussionSession, AIAgent, ConversationMessage, ConsensusCheck, FinalConclusion } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

import { 
  MessageSquare, 
  Send, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  RotateCcw,
  Target,
  FileText
} from 'lucide-react';

interface DiscussionPanelProps {
  agents: AIAgent[];
  session: DiscussionSession | null;
  discussionState: {
    phase: string;
    currentRound: number;
    messages: ConversationMessage[];
    lastConsensusCheck: ConsensusCheck | null;
    conclusion: FinalConclusion | null;
    error: string | null;
    typingAgents: string[];
  };
  onStartDiscussion: (topic: string, context: string, participantIds: string[]) => void;
  onStopDiscussion: () => void;
  onResetDiscussion: () => void;
}

export const DiscussionPanel = ({
  agents,
  session,
  discussionState,
  onStartDiscussion,
  onStopDiscussion,
  onResetDiscussion
}: DiscussionPanelProps) => {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussionState.messages]);

  const enabledAgents = agents.filter(a => a.enabled);

  const handleStart = () => {
    if (topic.trim() && selectedAgents.length >= 2) {
      onStartDiscussion(topic.trim(), context.trim(), selectedAgents);
    }
  };

  const isRunning = discussionState.phase !== 'idle' && discussionState.phase !== 'completed' && discussionState.phase !== 'error';

  // 如果没有会话，显示创建界面
  if (!session) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            发起讨论
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>讨论主题</Label>
            <Input
              placeholder="输入你想要讨论的问题或话题..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>背景信息（可选）</Label>
            <Textarea
              placeholder="提供相关背景信息，帮助AI更好地理解问题..."
              value={context}
              onChange={e => setContext(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>选择参与的 AI Agent（至少选择2个）</Label>
            {enabledAgents.length === 0 ? (
              <div className="p-4 border rounded-lg bg-gray-50 text-center text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>请先配置并启用至少2个AI Agent</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {enabledAgents.map(agent => (
                  <div
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgents(prev => 
                        prev.includes(agent.id)
                          ? prev.filter(id => id !== agent.id)
                          : [...prev, agent.id]
                      );
                    }}
                    className={`
                      p-3 border rounded-lg cursor-pointer transition-all
                      ${selectedAgents.includes(agent.id) 
                        ? 'border-violet-500 bg-violet-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <span style={{ color: agent.color }} className="text-sm font-medium">
                          {agent.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.personality}</p>
                      </div>
                      {selectedAgents.includes(agent.id) && (
                        <CheckCircle className="w-4 h-4 text-violet-500 ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleStart}
            disabled={!topic.trim() || selectedAgents.length < 2}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            开始讨论
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 有会话时，显示讨论界面
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4" />
              {session.topic}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                <Users className="w-3 h-3 mr-1" />
                {session.participantIds.length} 位参与者
              </Badge>
              <Badge variant="outline">
                第 {discussionState.currentRound}/5 轮
              </Badge>
              {discussionState.phase === 'completed' && (
                <Badge className="bg-green-500">已完成</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button variant="outline" size="sm" onClick={onStopDiscussion}>
                停止
              </Button>
            ) : discussionState.phase === 'completed' ? (
              <Button variant="outline" size="sm" onClick={onResetDiscussion}>
                <RotateCcw className="w-4 h-4 mr-1" />
                新的讨论
              </Button>
            ) : null}
          </div>
        </div>

        {/* 进度条 */}
        {isRunning && (
          <div className="mt-3">
            <Progress 
              value={(discussionState.currentRound / 5) * 100} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>讨论中...</span>
              <span>{Math.round((discussionState.currentRound / 5) * 100)}%</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* 系统消息 - 背景信息 */}
            {session.context && (
              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">背景信息：</p>
                {session.context}
              </div>
            )}

            {/* 用户问题 */}
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 bg-violet-600">
                <AvatarFallback className="text-white text-xs">我</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">用户</p>
                <div className="bg-violet-50 rounded-lg p-3 text-sm">
                  {session.topic}
                </div>
              </div>
            </div>

            {/* AI消息 */}
            {discussionState.messages.map((message, index) => {
              const agent = agents.find(a => a.id === message.agentId);
              if (!agent) return null;

              return (
                <div key={message.id || index} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <Avatar 
                    className="w-8 h-8"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    <AvatarFallback 
                      className="text-xs font-medium"
                      style={{ color: agent.color }}
                    >
                      {agent.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: agent.color }}>
                        {agent.name}
                      </span>
                      {message.metadata?.latency && (
                        <span className="text-xs text-gray-400">
                          {message.metadata.latency}ms
                        </span>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 正在输入指示器 */}
            {discussionState.typingAgents.length > 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">
                    {discussionState.typingAgents.map(id => 
                      agents.find(a => a.id === id)?.name
                    ).join('、')} 正在思考...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 共识检测结果 */}
        {discussionState.lastConsensusCheck && (
          <ConsensusResultPanel check={discussionState.lastConsensusCheck} />
        )}

        {/* 最终结论 */}
        {discussionState.conclusion && (
          <FinalConclusionPanel conclusion={discussionState.conclusion} />
        )}
      </CardContent>
    </Card>
  );
};

// ==================== 共识结果面板 ====================

const ConsensusResultPanel = ({ check }: { check: ConsensusCheck }) => {
  return (
    <div className="border-t bg-gradient-to-r from-violet-50 to-indigo-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className={`w-5 h-5 ${check.reached ? 'text-green-500' : 'text-amber-500'}`} />
        <span className="font-medium">
          第{check.round}轮共识检测
        </span>
        <Badge 
          variant={check.reached ? 'default' : 'secondary'}
          className={check.reached ? 'bg-green-500' : ''}
        >
          {check.reached ? '已达成共识' : '尚未达成共识'}
        </Badge>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>共识置信度</span>
          <span className="font-medium">{check.confidence.toFixed(0)}%</span>
        </div>
        <Progress value={check.confidence} className="h-2" />
      </div>

      {check.agreementPoints.length > 0 && (
        <div className="mb-2">
          <p className="text-sm font-medium mb-1">共识要点：</p>
          <div className="flex flex-wrap gap-1">
            {check.agreementPoints.map((point, i) => (
              <Badge key={i} variant="secondary" className="bg-white/80">
                {point}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {check.remainingDisagreements.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">待解决分歧：</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {check.remainingDisagreements.map((dis, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-amber-500">•</span>
                {dis}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 text-sm">
        <span className="text-gray-500">建议：</span>
        <span className={`
          ${check.suggestedAction === 'conclude' ? 'text-green-600 font-medium' : 'text-gray-700'}
        `}>
          {check.suggestedAction === 'continue' && '继续讨论'}
          {check.suggestedAction === 'conclude' && '可以得出结论'}
          {check.suggestedAction === 'need_more_info' && '需要更多信息'}
        </span>
      </div>
    </div>
  );
};

// ==================== 最终结论面板 ====================

const FinalConclusionPanel = ({ conclusion }: { conclusion: FinalConclusion }) => {
  return (
    <div className="border-t bg-gradient-to-r from-green-50 to-emerald-50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-green-600" />
        <span className="font-medium text-lg">最终结论</span>
        <Badge className="bg-green-500">
          置信度 {conclusion.confidence.toFixed(0)}%
        </Badge>
      </div>

      <div className="bg-white/80 rounded-lg p-4 mb-4">
        <p className="text-gray-800 font-medium leading-relaxed">
          {conclusion.conclusion}
        </p>
      </div>

      {conclusion.keyTakeaways.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">关键要点：</p>
          <ul className="space-y-1">
            {conclusion.keyTakeaways.map((point, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-500 font-bold">{i + 1}.</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conclusion.agentContributions.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">各方贡献：</p>
          <div className="grid gap-2">
            {conclusion.agentContributions.map((contrib, i) => (
              <div key={i} className="bg-white/60 rounded p-2 text-sm">
                <span className="font-medium">{contrib.agentName}：</span>
                <span className="text-gray-600">{contrib.contribution}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
