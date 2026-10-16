import { useEffect } from 'react';
import { toast } from 'sonner';

interface Labels {
  copy: string;
  copied: string;
  failed: string;
}

/**
 * 给正文里的代码块加"复制"按钮。
 *
 * 正文是数据库里存的 HTML，用 dangerouslySetInnerHTML 注入，
 * 拿不到 React 节点，所以只能在渲染完成后直接操作 DOM。
 *
 * @param selector 正文容器选择器，如 '#case-content'
 * @param labels   按钮与提示文案（调用方传入，便于中英切换）
 * @param ready    内容是否已就绪；内容变化时重新扫描
 */
export function useCodeCopy(selector: string, labels: Labels, ready: unknown) {
  useEffect(() => {
    const root = document.querySelector(selector);
    if (!root) return;

    const created: HTMLButtonElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 代码块和提示词块共用这一套按钮：两者都是"整块内容原样拿走"，
    // 没必要为提示词再写一遍复制逻辑。
    root.querySelectorAll('pre, [data-prompt]').forEach((node) => {
      const el = node as HTMLElement;
      // 内容重渲染时可能重复扫描到同一个块，打个标记避免插两个按钮
      if (el.dataset.copyReady === '1') return;
      el.dataset.copyReady = '1';

      // 按钮绝对定位在代码块右上角，父级必须是定位上下文
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.textContent = labels.copy;
      btn.setAttribute('aria-label', labels.copy);

      btn.addEventListener('click', async () => {
        // 取 textContent 而不是 innerText：后者会受 CSS 影响，
        // 代码块里的空行和缩进可能被吃掉
        const code = el.querySelector('code');
        let text: string;
        if (code) {
          text = code.textContent ?? '';
        } else {
          // 提示词块没有 <code>，直接取整块文字会把按钮自己的"复制"
          // 也带上，所以先复制一份节点、把按钮摘掉再取
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('.code-copy-btn').forEach((b) => b.remove());
          text = clone.textContent ?? '';
        }
        text = text.trim();
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = labels.copied;
          btn.classList.add('is-copied');
          toast.success(labels.copied);
          timers.push(setTimeout(() => {
            btn.textContent = labels.copy;
            btn.classList.remove('is-copied');
          }, 1800));
        } catch {
          // 浏览器不支持或用户拒绝了剪贴板权限
          toast.error(labels.failed);
        }
      });

      el.appendChild(btn);
      created.push(btn);
    });

    return () => {
      created.forEach((b) => {
        (b.parentElement as HTMLElement | null)?.removeAttribute('data-copy-ready');
        b.remove();
      });
      timers.forEach(clearTimeout);
    };
  }, [selector, labels.copy, labels.copied, labels.failed, ready]);
}
