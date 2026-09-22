import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

type DraftKey = { type: string; id: string };

function buildKey({ type, id }: DraftKey): string {
  return `qihe_draft_${type}_${id || 'new'}`;
}

export function loadDraft<T>(key: DraftKey): T | null {
  try {
    const raw = localStorage.getItem(buildKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: DraftKey, data: T): void {
  try {
    localStorage.setItem(buildKey(key), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // 隐私模式或存储满时静默失败
  }
}

export function removeDraft(key: DraftKey): void {
  try {
    localStorage.removeItem(buildKey(key));
  } catch {
    // ignore
  }
}

export function hasDraft(key: DraftKey): boolean {
  return !!localStorage.getItem(buildKey(key));
}

/**
 * 弹窗表单的本地草稿自动暂存与恢复提示。
 *
 * @param key 草稿键
 * @param value 当前表单值
 * @param setValue 恢复草稿时调用
 * @param enabled 是否启用（弹窗打开时为 true）
 * @returns clearDraft 保存成功后调用以清空草稿
 */
export function useLocalDraft<T>(
  key: DraftKey,
  value: T,
  setValue: (v: T) => void,
  enabled: boolean
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptedRef = useRef(false);

  // 弹窗打开时检测并提示恢复
  useEffect(() => {
    if (!enabled || promptedRef.current) return;
    const draft = loadDraft<T>(key);
    if (!draft) return;
    promptedRef.current = true;

    const tId = setTimeout(() => {
      const restored = JSON.stringify(draft) !== JSON.stringify(value);
      if (!restored) {
        removeDraft(key);
        return;
      }
      toast.info('检测到未保存的本地草稿', {
        description: '是否恢复上次编辑内容？',
        duration: 0,
        action: {
          label: '恢复',
          onClick: () => {
            setValue(draft);
            toast.success('草稿已恢复');
          },
        },
        cancel: {
          label: '丢弃',
          onClick: () => {
            removeDraft(key);
            toast.info('草稿已丢弃');
          },
        },
      });
    }, 300);
    return () => clearTimeout(tId);
  }, [enabled, key, value, setValue]);

  // 弹窗关闭或 key 变化时重置提示标记
  useEffect(() => {
    if (!enabled) promptedRef.current = false;
  }, [enabled]);

  // 变化后 2 秒自动暂存
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(key, value);
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, key, value]);

  const clearDraft = useCallback(() => {
    removeDraft(key);
    promptedRef.current = false;
  }, [key]);

  return { clearDraft };
}
