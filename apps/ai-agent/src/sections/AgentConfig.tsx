import { useState } from 'react';
import type { AIAgent, AIProviderConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit2, Check, X, Bot, User, Brain } from 'lucide-react';

interface AgentConfigProps {
  agents: AIAgent[];
  providers: AIProviderConfig[];
  onAdd: (agent: Omit<AIAgent, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<AIAgent>) => void;
  onRemove: (id: string) => void;
}

const thinkingStyleOptions = [
  { value: 'analytical', label: '分析型 - 注重逻辑和数据' },
  { value: 'intuitive', label: '直觉型 - 依靠直觉和洞察' },
  { value: 'critical', label: '批判型 - 善于质疑和挑战' },
  { value: 'creative', label: '创造型 - 思维跳跃和创新' },
  { value: 'balanced', label: '平衡型 - 综合各方观点' }
];

// 预设的System Prompt模板
const systemPromptTemplates: Record<string, string> = {
  analytical: `你是一位严谨的分析者。在讨论中，你应该：
- 注重事实和逻辑，基于已有信息进行分析
- 提出具体的数据和证据支持你的观点
- 识别问题中的关键因素和变量
- 保持客观理性的态度
- 在与其他AI讨论时，认真考虑他们的观点
你的目标是帮助团队达成准确、可靠的结论。`,

  critical: `你是一位善于质疑的思考者。在讨论中，你应该：
- 对提出的观点保持健康的怀疑态度
- 找出论证中的漏洞和假设
- 提出"如果...会怎样"的反事实问题
- 挑战共识，确保结论经得起检验
- 你的质疑应该建设性，目的是完善结论
你的目标是帮助团队发现盲点，避免草率结论。`,

  creative: `你是一位富有创造力的思考者。在讨论中，你应该：
- 提出 unconventional 的观点和角度
- 进行跨领域的联想和类比
- 思考"还有什么可能性"
- 不满足于显而易见的答案
- 在讨论中引入新的视角
你的目标是帮助团队突破思维定式。`,

  balanced: `你是一位擅长整合的思考者。在讨论中，你应该：
- 寻找不同观点之间的共同点和联系
- 调和看似矛盾的观点
- 提出综合性的解决方案
- 关注整体图景和长期影响
- 促进共识形成
你的目标是帮助团队找到平衡、可持续的结论。`,

  expert: `你是一位领域专家。在讨论中，你应该：
- 从专业角度深入分析问题
- 引用相关理论和最佳实践
- 识别潜在的技术细节和陷阱
- 提供可操作的实施建议
你的目标是提供专业深度的洞察。`
};

export const AgentConfig = ({ agents, providers, onAdd, onUpdate, onRemove }: AgentConfigProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    providerId: '',
    color: '#3b82f6',
    systemPrompt: '',
    personality: '',
    thinkingStyle: 'analytical' as AIAgent['thinkingStyle'],
    enabled: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      providerId: providers[0]?.id || '',
      color: '#3b82f6',
      systemPrompt: '',
      personality: '',
      thinkingStyle: 'analytical',
      enabled: true
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.providerId || !formData.systemPrompt) return;
    
    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    resetForm();
  };

  const startEdit = (agent: AIAgent) => {
    setFormData({
      name: agent.name,
      providerId: agent.providerId,
      color: agent.color,
      systemPrompt: agent.systemPrompt,
      personality: agent.personality,
      thinkingStyle: agent.thinkingStyle,
      enabled: agent.enabled
    });
    setEditingId(agent.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const applyTemplate = (templateKey: string) => {
    setFormData({
      ...formData,
      systemPrompt: systemPromptTemplates[templateKey] || ''
    });
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name || '未配置';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Agent 配置
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            配置参与讨论的AI Agent，每个Agent有独立的身份和视角
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              onClick={() => { 
                resetForm(); 
                setIsAdding(true); 
              }}
              disabled={providers.length === 0}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加 AI Agent</DialogTitle>
            </DialogHeader>
            <AgentForm 
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={cancelEdit}
              onApplyTemplate={applyTemplate}
              providers={providers}
              isEditing={false}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>请先配置 AI Provider</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无配置，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(agent => (
              <div 
                key={agent.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                {editingId === agent.id ? (
                  <div className="flex-1">
                    <AgentForm
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleSubmit}
                      onCancel={cancelEdit}
                      onApplyTemplate={applyTemplate}
                      providers={providers}
                      isEditing={true}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <User className="w-5 h-5" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          <Badge 
                            variant="secondary"
                            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                          >
                            {agent.thinkingStyle}
                          </Badge>
                          {agent.enabled ? (
                            <Badge variant="default" className="bg-green-500">启用</Badge>
                          ) : (
                            <Badge variant="secondary">禁用</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Provider: {getProviderName(agent.providerId)} | {agent.personality}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => startEdit(agent)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onRemove(agent.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Agent 表单组件 ====================

interface AgentFormProps {
  formData: {
    name: string;
    providerId: string;
    color: string;
    systemPrompt: string;
    personality: string;
    thinkingStyle: AIAgent['thinkingStyle'];
    enabled: boolean;
  };
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onApplyTemplate: (template: string) => void;
  providers: AIProviderConfig[];
  isEditing: boolean;
}

const AgentForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel, 
  onApplyTemplate,
  providers,
  isEditing 
}: AgentFormProps) => {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>名称</Label>
          <Input
            placeholder="例如：分析者"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <Label>关联 Provider</Label>
          <Select 
            value={formData.providerId} 
            onValueChange={v => setFormData({ ...formData, providerId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择Provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>个性描述</Label>
          <Input
            placeholder="例如：理性、严谨"
            value={formData.personality}
            onChange={e => setFormData({ ...formData, personality: e.target.value })}
          />
        </div>
        <div>
          <Label>思考风格</Label>
          <Select 
            value={formData.thinkingStyle} 
            onValueChange={v => setFormData({ ...formData, thinkingStyle: v as AIAgent['thinkingStyle'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {thinkingStyleOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>标识颜色</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={formData.color}
            onChange={e => setFormData({ ...formData, color: e.target.value })}
            className="w-16 h-10 p-1"
          />
          <span className="text-sm text-gray-500">{formData.color}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>System Prompt（定义AI的"本心"）</Label>
          <div className="flex gap-1">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => onApplyTemplate('analytical')}
            >
              分析型
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => onApplyTemplate('critical')}
            >
              批判型
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => onApplyTemplate('creative')}
            >
              创造型
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => onApplyTemplate('balanced')}
            >
              平衡型
            </Badge>
          </div>
        </div>
        <Textarea
          placeholder="输入System Prompt，定义这个AI的角色、视角和行为方式..."
          value={formData.systemPrompt}
          onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
          className="min-h-[200px]"
        />
        <p className="text-xs text-gray-500 mt-1">
          System Prompt决定了AI的"本心"。即使是同一个模型，不同的Prompt也会让AI表现出不同的视角。
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          取消
        </Button>
        <Button onClick={onSubmit}>
          <Check className="w-4 h-4 mr-1" />
          {isEditing ? '保存' : '添加'}
        </Button>
      </div>
    </div>
  );
};
