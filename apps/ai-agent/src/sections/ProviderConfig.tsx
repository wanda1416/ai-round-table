import { useState } from 'react';
import type { AIProviderConfig, AIProviderType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, Edit2, Check, X, Key, Server } from 'lucide-react';

interface ProviderConfigProps {
  providers: AIProviderConfig[];
  onAdd: (provider: Omit<AIProviderConfig, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<AIProviderConfig>) => void;
  onRemove: (id: string) => void;
}

const providerTypeOptions: { value: AIProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'custom', label: '自定义 (OpenAI兼容)' }
];

const defaultModels: Record<AIProviderType, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  custom: ['custom-model']
};

export const ProviderConfig = ({ providers, onAdd, onUpdate, onRemove }: ProviderConfigProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'openai' as AIProviderType,
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    enabled: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'openai',
      apiKey: '',
      baseUrl: '',
      model: 'gpt-4o-mini',
      enabled: true
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.apiKey) return;
    
    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    resetForm();
  };

  const startEdit = (provider: AIProviderConfig) => {
    setFormData({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || '',
      model: provider.model,
      enabled: provider.enabled
    });
    setEditingId(provider.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="w-5 h-5" />
            AI Provider 配置
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            配置你要接入的AI服务（OpenAI、Claude、Gemini等）
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { resetForm(); setIsAdding(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加 AI Provider</DialogTitle>
            </DialogHeader>
            <ProviderForm 
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={cancelEdit}
              isEditing={false}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无配置，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map(provider => (
              <div 
                key={provider.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                {editingId === provider.id ? (
                  <div className="flex-1">
                    <ProviderForm
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleSubmit}
                      onCancel={cancelEdit}
                      isEditing={true}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-3 h-3 rounded-full ${
                          provider.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`} 
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{provider.name}</span>
                          <Badge variant="secondary">{provider.type}</Badge>
                          <Badge variant="outline">{provider.model}</Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          API Key: {provider.apiKey ? '••••' + provider.apiKey.slice(-4) : '未设置'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => startEdit(provider)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onRemove(provider.id)}
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

// ==================== Provider 表单组件 ====================

interface ProviderFormProps {
  formData: {
    name: string;
    type: AIProviderType;
    apiKey: string;
    baseUrl: string;
    model: string;
    enabled: boolean;
  };
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

const ProviderForm = ({ formData, setFormData, onSubmit, onCancel, isEditing }: ProviderFormProps) => {
  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label>名称</Label>
        <Input
          placeholder="例如：我的OpenAI"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div>
        <Label>类型</Label>
        <Select 
          value={formData.type} 
          onValueChange={(v: AIProviderType) => {
            setFormData({ 
              ...formData, 
              type: v,
              model: defaultModels[v][0]
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerTypeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>API Key</Label>
        <Input
          type="password"
          placeholder="输入你的API Key"
          value={formData.apiKey}
          onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
        />
      </div>

      <div>
        <Label>模型</Label>
        <Select 
          value={formData.model} 
          onValueChange={v => setFormData({ ...formData, model: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {defaultModels[formData.type].map(model => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>自定义API地址（可选）</Label>
        <Input
          placeholder="https://api.openai.com/v1"
          value={formData.baseUrl}
          onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
        />
        <p className="text-xs text-gray-500 mt-1">用于代理或自定义部署，留空使用默认地址</p>
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
