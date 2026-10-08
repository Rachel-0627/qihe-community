import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchAiTools } from '@/lib/aiToolsApi';
import { ArrowUpRight } from 'lucide-react';
import type { AiTool } from '@/types/types';

/**
 * 工具收录卡片墙。
 *
 * 社区只收录和跳转，工具本身跑在对方站点上，所以卡片一律新标签页打开，
 * 并带 noreferrer，避免把站内路径带给第三方。
 */
export default function AiToolGrid() {
  const { t } = useI18n();
  const [items, setItems] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>('全部');

  useEffect(() => {
    fetchAiTools()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // 分类按实际收录情况生成，没有条目的分类不占位
  const categories = useMemo(() => {
    const seen: string[] = [];
    items.forEach((i) => { if (!seen.includes(i.category)) seen.push(i.category); });
    return ['全部', ...seen];
  }, [items]);

  const visible = active === '全部' ? items : items.filter((i) => i.category === active);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>;
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('暂无收录工具', 'No tools yet')}</p>;
  }

  return (
    <div>
      {categories.length > 2 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`border px-3 py-1 font-mono-label text-xs uppercase tracking-wider transition-colors ${
                active === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tool) => (
          <a
            key={tool.id}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-border bg-card transition-colors hover:border-primary/60"
          >
            <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
              {tool.cover_url ? (
                <img
                  src={tool.cover_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-sm font-medium text-foreground">{tool.name}</h3>
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{tool.summary}</p>
              {/* 分类已经印在封面图上，这里只补一个来源，避免同一张卡上重复两遍 */}
              <div className="truncate pt-1 font-mono-label text-[10px] tracking-wider text-muted-foreground">
                {tool.provider}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
