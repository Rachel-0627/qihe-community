import { useEffect, useState, useCallback } from 'react';
import { Key, Save, Loader2, Code2, Copy, Check, Sparkles, Terminal, FileCode2, BookOpen } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyImageProviderConfig, saveMyImageProviderConfig } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function UserImageProviderConfig() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultSize, setDefaultSize] = useState('1024x1024');
  const [customRequestCode, setCustomRequestCode] = useState('');
  const [activeTab, setActiveTab] = useState<'curl' | 'python'>('curl');
  const [copied, setCopied] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // 协议设置弹窗状态与选中的协议标签
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [protocolTab, setProtocolTab] = useState<'openai' | 'claude' | 'gemini'>('openai');
  const [currentProtocol, setCurrentProtocol] = useState<'openai' | 'claude' | 'gemini'>('openai');
  const [protocolCopied, setProtocolCopied] = useState(false);
  // 用户在协议弹窗中自定义编辑的内容（按 tab 记录）
  const [editedProtocolTexts, setEditedProtocolTexts] = useState<Record<string, string>>({});

  // 加载配置：直接以服务端（Edge Function / 数据库 / Vault）为唯一真理源，不读取 localStorage 避免过期数据污染
  const loadConfig = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const cfg = await fetchMyImageProviderConfig();
      if (cfg) {
        setProvider(cfg.provider || '');
        setBaseUrl(cfg.base_url || '');
        setModel(cfg.model || '');
        if (cfg.protocol) {
          const proto = (cfg.protocol as 'openai' | 'claude' | 'gemini');
          setCurrentProtocol(proto);
          setProtocolTab(proto);
        }
        if (cfg.default_size) setDefaultSize(cfg.default_size);
        if (cfg.request_body_template) {
          setCustomRequestCode(cfg.request_body_template);
        }
        if (cfg.protocol_settings && typeof cfg.protocol_settings === 'object') {
          setEditedProtocolTexts(cfg.protocol_settings);
        }
        setHasConfig(true);
        const isConfigured = Boolean(cfg.apiKeyConfigured ?? cfg.has_api_key);
        setHasApiKey(isConfigured);
      } else {
        setHasConfig(false);
        setHasApiKey(false);
      }
    } catch (err) {
      toast.error((err as Error)?.message || t('加载配置失败', 'Failed to load config'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 根据当前配置动态生成标准 cURL 命令
  const buildCurlSnippet = () => {
    const url = (baseUrl.trim() || 'https://api.yunmengapi.com/v1').replace(/\/$/, '');
    const m = model.trim() || 'gpt-image2-1k';
    const s = defaultSize.trim() || '1024x1024';
    return `curl ${url}/images/generations \\
  -H "Authorization: Bearer \${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${m}",
    "prompt": "一只在雪地里打滚的柴犬，电影感光线",
    "size": "${s}",
    "n": 1
  }'

# 4K 提示：换成 "model": "gpt-image2-4k" 并传 "size": "3840x2160"`;
  };

  // 根据当前配置动态生成 Python 调用脚本
  const buildPythonSnippet = () => {
    const url = (baseUrl.trim() || 'https://api.yunmengapi.com/v1').replace(/\/$/, '');
    const m = model.trim() || 'gpt-image2-1k';
    const s = defaultSize.trim() || '1024x1024';
    return `import requests

url = "${url}/images/generations"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "model": "${m}",
    "prompt": "一只在雪地里打滚的柴犬，电影感光线",
    "size": "${s}",
    "n": 1
}

# 4K 提示：换成 "model": "gpt-image2-4k" 并传 "size": "3840x2160"
response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('代码已复制到剪贴板', 'Code copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('复制失败', 'Copy failed'));
    }
  };

  // 协议设置内容定义
  const getProtocolEndpoint = (type: 'openai' | 'claude' | 'gemini') => {
    const domain = (baseUrl.trim() || 'https://api.yunmengapi.com/v1').replace(/\/v1\/?$/, '');
    if (type === 'openai') {
      return `POST ${domain}/v1/chat/completions\n\n# 最通用。绝大多数客户端和 SDK 都支持，\n# 只需把 base_url 改成上面这个地址。`;
    }
    if (type === 'claude') {
      return `POST ${domain}/v1/messages\n\n# 原生支持 Claude 官方 SDK 和客户端。\n# 可直接作为 Anthropic Base URL 使用。`;
    }
    return `POST ${domain}/v1beta/chat/completions\n\n# 兼容 Google Gemini 原生格式。\n# 只需把 base_url 改成上面这个地址。`;
  };

  const handleCopyProtocol = async () => {
    const text = editedProtocolTexts[protocolTab] ?? getProtocolEndpoint(protocolTab);
    try {
      await navigator.clipboard.writeText(text);
      setProtocolCopied(true);
      toast.success(t('协议地址已复制', 'Protocol copied'));
      setTimeout(() => setProtocolCopied(false), 2000);
    } catch {
      toast.error(t('复制失败', 'Copy failed'));
    }
  };

  const handleResetProtocol = () => {
    setEditedProtocolTexts((prev) => {
      const next = { ...prev };
      delete next[protocolTab];
      return next;
    });
    toast.info(t('已恢复当前协议默认模板', 'Reset to default protocol template'));
  };

  const handleApplyProtocolBaseUrl = () => {
    const text = editedProtocolTexts[protocolTab] ?? getProtocolEndpoint(protocolTab);
    const selectedProto = protocolTab;
    setCurrentProtocol(selectedProto);

    const match = text.match(/https?:\/\/[^\s\n\r"']+/i);
    if (match && match[0]) {
      const full = match[0];
      const cleaned = full.replace(/\/(chat\/completions|messages|images\/generations)\/?$/i, '');
      setBaseUrl(cleaned);
      setProtocolDialogOpen(false);
      toast.success(t('已从协议配置中提取并应用 Base URL', 'Base URL applied from protocol config'));
      return;
    }

    const domain = (baseUrl.trim() || 'https://api.yunmengapi.com/v1').replace(/\/v1\/?$/, '');
    if (selectedProto === 'openai') setBaseUrl(`${domain}/v1`);
    else if (selectedProto === 'claude') setBaseUrl(`${domain}/v1`);
    else setBaseUrl(`${domain}/v1beta`);
    setProtocolDialogOpen(false);
    toast.success(t('已应用该协议 Base URL', 'Base URL updated'));
  };

  // 智能解析用户粘贴的 cURL 命令或 JSON 请求体并自动回填
  const handleParseAndFill = (text: string) => {
    if (!text.trim()) return;

    let matchedAny = false;

    // 1. 尝试匹配 URL
    const urlMatch = text.match(/curl\s+["']?(https?:\/\/[^\s"']+)/i);
    if (urlMatch && urlMatch[1]) {
      const fullUrl = urlMatch[1];
      const base = fullUrl.replace(/\/images\/generations\/?$/, '');
      setBaseUrl(base);
      matchedAny = true;
    }

    // 2. 尝试匹配 Authorization: Bearer xxx
    const authMatch = text.match(/Bearer\s+([A-Za-z0-9_\-\.]+)/i);
    if (authMatch && authMatch[1] && !authMatch[1].startsWith('$') && !authMatch[1].includes('YOUR_')) {
      setApiKey(authMatch[1]);
      matchedAny = true;
    }

    // 3. 尝试匹配 -d '...' 里的 JSON 数据
    let jsonString = '';
    const dMatch = text.match(/-d\s+['"](\{[\s\S]*?\})['"]/);
    if (dMatch && dMatch[1]) {
      jsonString = dMatch[1];
    } else {
      const braceMatch = text.match(/(\{[\s\S]*\})/);
      if (braceMatch && braceMatch[1]) {
        jsonString = braceMatch[1];
      }
    }

    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.model) {
          setModel(parsed.model);
          matchedAny = true;
        }
        if (parsed.size) {
          setDefaultSize(parsed.size);
          matchedAny = true;
        }
      } catch {
        // ignore
      }
    }

    if (matchedAny) {
      toast.success(t('已自动提取并填入配置字段', 'Extracted and filled configuration fields'));
    } else {
      toast.info(t('未检测到可提取的标准参数', 'No extractable parameters detected'));
    }
  };

  const handleSave = async () => {
    if (!provider.trim() || !baseUrl.trim() || !model.trim()) {
      toast.error(t('请填写完整的服务商名称、Base URL 与模型 ID', 'Please fill in Provider, Base URL, and Model'));
      return;
    }

    setSaving(true);
    try {
      await saveMyImageProviderConfig({
        provider: provider.trim(),
        base_url: baseUrl.trim(),
        model: model.trim(),
        protocol: currentProtocol,
        api_key: apiKey.trim() || undefined,
        default_size: defaultSize.trim() || '1024x1024',
        request_body_template: customRequestCode.trim() || undefined,
        protocol_settings: editedProtocolTexts,
      });
      setHasConfig(true);
      if (apiKey.trim()) setHasApiKey(true);
      setApiKey(''); // 清空当前输入的明文 key，避免滞留屏幕
      toast.success(t('配置已成功保存', 'Configuration saved successfully'));
    } catch (err) {
      toast.error((err as Error)?.message || t('保存失败', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const currentDisplaySnippet = activeTab === 'curl' ? (customRequestCode.trim() || buildCurlSnippet()) : buildPythonSnippet();

  return (
    <div className="space-y-6">
      {/* 基础模型配置 */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Key className="h-4 w-4 text-primary" />
            {t('生图模型配置', 'Image Generation Provider')}
          </CardTitle>
          <CardDescription>
            {t('支持 OpenAI 兼容接口（/v1/images/generations），API key 加密存储。配置完成后可在提示词案例库中点击「生成图片」使用。', 'Supports OpenAI-compatible endpoints; API key is encrypted. Configure it here to use Generate Image in the prompt case library.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !provider ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />{t('加载中…', 'Loading…')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('服务商名称', 'Provider')}</Label>
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="云梦API / OpenAI / SiliconFlow" className="px-3" />
              </div>
              <div className="space-y-2">
                <Label>{t('模型 ID', 'Model')}</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-image2-1k / gpt-image2-4k / dall-e-3" className="px-3" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t('Base URL', 'Base URL')}</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.yunmengapi.com/v1" className="px-3" />
              </div>

              {/* API Key 这一行，右侧增加协议设置入口 */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('API Key', 'API Key')}{' '}
                    {(hasConfig || hasApiKey) && (
                      <span className="text-xs text-accent font-normal">
                        （{t('已加密保存，留空则保持不变', 'Saved securely; leave blank to keep')}）
                      </span>
                    )}
                  </Label>

                  {/* 协议设置入口弹窗 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t('当前协议:', 'Current:')}{' '}
                      <span className="font-mono text-primary font-medium uppercase">{currentProtocol}</span>
                    </span>
                    <Dialog open={protocolDialogOpen} onOpenChange={setProtocolDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs border-accent/40 text-accent hover:bg-accent/10"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          {t('协议设置', 'Protocol Settings')}
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-sm font-medium">
                          {t('同一个 Key 支持三种协议，按你的客户端选一个：', 'One key supports 3 protocols, choose according to your client:')}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          {t('支持直接复制接入地址，或快速应用为当前 Base URL。', 'Copy API endpoint directly or apply to current Base URL.')}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="mt-2 space-y-3">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setProtocolTab('openai')}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                protocolTab === 'openai'
                                  ? 'border-b-2 border-primary text-primary font-medium bg-primary/10'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              OpenAI 协议
                            </button>
                            <button
                              type="button"
                              onClick={() => setProtocolTab('claude')}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                protocolTab === 'claude'
                                  ? 'border-b-2 border-primary text-primary font-medium bg-primary/10'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Claude 协议
                            </button>
                            <button
                              type="button"
                              onClick={() => setProtocolTab('gemini')}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                protocolTab === 'gemini'
                                  ? 'border-b-2 border-primary text-primary font-medium bg-primary/10'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Gemini 协议
                            </button>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyProtocol}
                            className="h-7 text-xs px-2 gap-1"
                          >
                            {protocolCopied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                            {protocolCopied ? t('已复制', 'Copied') : t('复制', 'Copy')}
                          </Button>
                        </div>

                        {/* 协议详细信息代码块：支持可自由编辑 */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {t('协议接入说明与地址（支持自由编辑修改）：', 'Protocol instructions & endpoint (editable):')}
                            </span>
                            {editedProtocolTexts[protocolTab] !== undefined && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleResetProtocol}
                                className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5"
                              >
                                {t('恢复默认', 'Reset default')}
                              </Button>
                            )}
                          </div>
                          <Textarea
                            value={editedProtocolTexts[protocolTab] ?? getProtocolEndpoint(protocolTab)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedProtocolTexts((prev) => ({
                                ...prev,
                                [protocolTab]: val,
                              }));
                            }}
                            rows={6}
                            className="rounded-lg border border-border bg-black/70 p-3 font-mono text-xs text-[#ecebe7] leading-relaxed resize-y focus-visible:ring-accent"
                            spellCheck={false}
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApplyProtocolBaseUrl}
                            className="text-xs h-8"
                          >
                            {t('应用此协议 Base URL', 'Apply this Base URL')}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasConfig || hasApiKey ? t('已保存加密密钥，留空保持不变', 'Saved securely; leave blank to keep') : "sk-..."}
                    className="px-3"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 生图请求方式（cURL 与 Python 两种方式） */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Code2 className="h-4 w-4 text-accent" />
                {t('生图请求方式 (cURL / Python)', 'Image Generation Request (cURL / Python)')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('提供 cURL 与 Python 两种调用方式，根据当前配置自动生成代码，亦可直接粘贴您的服务商示例命令。', 'Provides cURL and Python modes, automatically generated from your config, or paste your vendor snippet directly.')}
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyCode(currentDisplaySnippet)}
              className="gap-1.5 self-start md:self-auto text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('已复制', 'Copied') : t('复制代码', 'Copy Code')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'curl' | 'python')}>
            <TabsList className="bg-muted/60">
              <TabsTrigger value="curl" className="gap-1.5 text-xs">
                <Terminal className="h-3.5 w-3.5" />
                cURL
              </TabsTrigger>
              <TabsTrigger value="python" className="gap-1.5 text-xs">
                <FileCode2 className="h-3.5 w-3.5" />
                Python
              </TabsTrigger>
            </TabsList>

            {/* cURL 方式 */}
            <TabsContent value="curl" className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('可直接粘贴服务商提供的 cURL 命令（点击下方按钮可自动提取并填入配置）：', 'You can paste your vendor cURL command directly:')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleParseAndFill(customRequestCode)}
                  className="h-7 text-xs text-accent hover:text-accent/90"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('从 cURL 自动提取参数', 'Extract Params from cURL')}
                </Button>
              </div>
              <Textarea
                value={customRequestCode || buildCurlSnippet()}
                onChange={(e) => {
                  setCustomRequestCode(e.target.value);
                }}
                rows={9}
                className="font-mono text-xs leading-relaxed bg-black/70 border-border/80 px-3 py-2 text-[#ecebe7] focus-visible:ring-accent resize-y"
                spellCheck={false}
              />
            </TabsContent>

            {/* Python 方式 */}
            <TabsContent value="python" className="mt-3 space-y-2">
              <span className="text-xs text-muted-foreground">
                {t('Python requests 请求示例代码（可直接复制使用）：', 'Python requests snippet ready to use:')}
              </span>
              <Textarea
                value={buildPythonSnippet()}
                readOnly
                rows={11}
                className="font-mono text-xs leading-relaxed bg-black/70 border-border/80 px-3 py-2 text-[#ecebe7] focus-visible:ring-accent resize-none"
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            {t('提示：具体的生图尺寸、模型计费与对应说明已放置在前端案例详情页生图时供您选择使用。', 'Note: Image sizes and model billing notes are available in the front-end prompt case detail page during generation.')}
          </p>
        </CardContent>
      </Card>

      {/* 底部保存按钮 */}
      <div>
        <Button onClick={handleSave} disabled={saving || loading} className="gap-1.5 px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('保存全部配置', 'Save Configuration')}
        </Button>
      </div>
    </div>
  );
}
