import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendStreamRequest } from '@/lib/sse';
import type { ChatMessage } from '@/types/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function AIAssistant() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { open, setOpen, toggle } = useAIAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [assistantName, setAssistantName] = useState('Aria');
  const [greeting, setGreeting] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      import('@/lib/api').then(({ fetchAssistantConfig }) => {
        fetchAssistantConfig().then((cfg) => {
          if (cfg) {
            setAssistantName(lang === 'en' ? cfg.persona_name_en : cfg.persona_name);
            setGreeting(lang === 'en' ? cfg.greeting_en : cfg.greeting);
            setMessages([{ role: 'assistant', content: lang === 'en' ? cfg.greeting_en : cfg.greeting }]);
          }
        });
      });
    }
  }, [open, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    // AI 助手按用户计费限流，未登录无法使用
    if (!user) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('请先登录后再和我聊天哦～', 'Please sign in first to chat with me.') },
      ]);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: text };
    const history = messages.filter((m) => m.content);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const apiMessages = [...history, userMsg].map((m) => ({ role: m.role, content: m.content }));
    let acc = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    abortRef.current = new AbortController();
    const { data: { session } } = await supabase.auth.getSession();
    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/ai-assistant`,
      requestBody: { messages: apiMessages, lang },
      supabaseAnonKey,
      accessToken: session?.access_token,
      signal: abortRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            acc += chunk;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: acc };
              return next;
            });
          }
        } catch {
          // ignore non-JSON frames
        }
      },
      onComplete: () => {
        setStreaming(false);
        if (!acc) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: t('抱歉，暂时无法回复，请稍后再试。', 'Sorry, I could not respond right now. Please try again later.') };
            return next;
          });
        }
      },
      onError: async (err) => {
        setStreaming(false);
        // Edge Function 返回的 4xx/5xx 里带有面向用户的中文说明（如额度已用完），优先展示
        let msg = t('连接失败，请稍后再试。', 'Connection failed. Please try again later.');
        const res = (err as unknown as { response?: Response }).response;
        if (res) {
          try {
            const body = await res.json();
            if (body?.error && typeof body.error === 'string') msg = body.error;
          } catch {
            // 响应体不是 JSON，沿用默认文案
          }
        }
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: msg };
          return next;
        });
      },
    });
  }, [input, streaming, messages, lang, t, user]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-[14px] right-[14px] z-50 h-[60px] w-[60px] rounded-[19px] border border-primary/30 bg-card/95 shadow-[0_20px_55px_hsl(14_54%_38%_/.18),inset_0_1px_0_hsl(40_100%_99%_/.8)] backdrop-blur-[18px] transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[4px] hover:border-primary/55 md:bottom-[22px] md:right-[22px] md:h-[66px] md:w-[66px]"
        aria-label={t('AI 助手', 'AI Assistant')}
      >
        <span className="pointer-events-none absolute inset-[8px] rounded-[13px] border border-primary/10" aria-hidden="true" />
        {/* 猫（与 index-v3.html 一致：头像静止，仅眼睛眨眼） */}
        <span className="absolute left-[12px] top-[15px] block h-[29px] w-[34px] rounded-[8px_8px_12px_12px] border border-primary/65 bg-gradient-to-br from-primary/10 to-transparent md:left-[15px] md:top-[18px]" aria-hidden="true">
          {/* 左耳 */}
          <span className="absolute -top-[7px] left-[2px] h-[10px] w-[10px] rotate-[24deg] border-l border-t border-primary/65 bg-card" />
          {/* 右耳 */}
          <span className="absolute -top-[7px] right-[2px] h-[10px] w-[10px] -rotate-[24deg] border-r border-t border-primary/65 bg-card" />
          {/* 眼睛：仅眼睛应用眨眼动画，头像不折叠 */}
          <span className="absolute left-[8px] right-[8px] top-[11px] flex justify-between">
            <i className="cat-eye h-[4px] w-[4px] animate-[blink_5s_infinite] rounded-full bg-primary shadow-[0_0_8px_hsl(14_54%_52%_/.35)]" />
            <i className="cat-eye h-[4px] w-[4px] animate-[blink_5s_infinite] rounded-full bg-primary shadow-[0_0_8px_hsl(14_54%_52%_/.35)]" />
          </span>
          {/* 嘴 */}
          <span className="absolute bottom-[5px] left-[13px] h-[3px] w-[8px] rounded-[50%] border-b border-primary/70" />
        </span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col border border-border bg-card/95 shadow-[0_30px_90px_hsl(14_54%_38%_/.2)] backdrop-blur-[24px] md:right-6">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              {/* 小猫头像（与右下角入口一致，会眨眼） */}
              <span className="relative block h-[30px] w-[30px] rounded-[8px_8px_10px_10px] border border-primary/65 bg-gradient-to-br from-primary/10 to-transparent">
                <span className="absolute -top-[5px] left-[2px] h-[8px] w-[8px] rotate-[24deg] border-l border-t border-primary/65 bg-card" />
                <span className="absolute -top-[5px] right-[2px] h-[8px] w-[8px] -rotate-[24deg] border-r border-t border-primary/65 bg-card" />
                <span className="absolute left-[6px] right-[6px] top-[10px] flex justify-between">
                  <i className="cat-eye h-[3px] w-[3px] animate-[blink_5s_infinite] rounded-full bg-primary shadow-[0_0_6px_hsl(14_54%_52%_/.35)]" />
                  <i className="cat-eye h-[3px] w-[3px] animate-[blink_5s_infinite] rounded-full bg-primary shadow-[0_0_6px_hsl(14_54%_52%_/.35)]" />
                </span>
                <span className="absolute bottom-[4px] left-1/2 h-[2px] w-[6px] -translate-x-1/2 rounded-[50%] border-b border-primary/70" />
              </span>
              <div>
                <p className="text-[13px] font-medium leading-none text-foreground">{assistantName}</p>
                <p className="mt-1 font-mono text-[9px] text-primary">{t('在线 · 社区智能伙伴', 'Online · Community partner')}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-muted text-foreground'
                    }`}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  user
                    ? (lang === 'zh' ? `向 ${assistantName} 提问…` : `Ask ${assistantName}…`)
                    : t('登录后即可使用助手', 'Sign in to use the assistant')
                }
                disabled={!user}
                className="max-h-24 min-h-[40px] flex-1 resize-none border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!user || streaming || !input.trim()}
                className="h-10 w-10 shrink-0 border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
