import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, ImageOff, Filter, ChevronDown } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchPromptCaseFilters, fetchPromptCases } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PromptCaseDetail from './PromptCaseDetail';
import type { PromptCase, PromptCaseFilter, PromptCaseFilterGroup } from '@/types/types';

function aspectClass(ratio: string): string {
  switch (ratio) {
    case '3:4': return 'aspect-[3/4]';
    case '4:3': return 'aspect-[4/3]';
    case '9:16': return 'aspect-[9/16]';
    case '16:9': return 'aspect-[16/9]';
    case '2.35:1': return 'aspect-[2.35/1]';
    default: return 'aspect-[4/3]';
  }
}

export default function PromptCaseLibrary() {
  const { t, lang } = useI18n();
  const [cases, setCases] = useState<PromptCase[]>([]);
  const [filters, setFilters] = useState<PromptCaseFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [selectedScene, setSelectedScene] = useState<string>('all');
  const [detailItem, setDetailItem] = useState<PromptCase | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    Promise.all([fetchPromptCases(), fetchPromptCaseFilters()])
      .then(([caseRows, filterRows]) => {
        setCases(caseRows);
        setFilters(filterRows);
      })
      .catch(() => toast.error(t('加载案例失败', 'Failed to load prompt cases')))
      .finally(() => setLoading(false));
  }, [t]);

  const grouped = useMemo(() => {
    const byGroup = { category: [], style: [], scene: [] } as Record<PromptCaseFilterGroup, PromptCaseFilter[]>;
    filters.forEach((f) => {
      if (byGroup[f.group]) byGroup[f.group].push(f);
    });
    return byGroup;
  }, [filters]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (selectedCategory !== 'all' && c.category_id !== selectedCategory) return false;
      if (selectedStyle !== 'all' && c.style_id !== selectedStyle) return false;
      if (selectedScene !== 'all' && c.scene_id !== selectedScene) return false;
      return true;
    });
  }, [cases, selectedCategory, selectedStyle, selectedScene]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedStyle('all');
    setSelectedScene('all');
  };

  const hasActiveFilter = selectedCategory !== 'all' || selectedStyle !== 'all' || selectedScene !== 'all';

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>;
  }

  return (
    <div className="space-y-4">
      {/* 紧凑单/双行筛选栏，消除原先 Accordion 展开带来的大面积空白 */}
      <div className="rounded-lg border border-border/80 bg-card/60 p-3 space-y-2.5">
        {/* 分类行（首要核心筛选） */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-mono-label text-[11px] text-muted-foreground w-10 shrink-0">
            {t('分类', 'Cat')}:
          </span>
          <FilterChip label={lang === 'en' ? 'All' : '全部'} selected={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
          {grouped.category
            .filter((o) => o.name !== '全部' && o.name_en !== 'All')
            .map((option) => (
              <FilterChip
                key={option.id}
                label={lang === 'en' && option.name_en ? option.name_en : option.name}
                selected={selectedCategory === option.id}
                onClick={() => setSelectedCategory(option.id)}
              />
            ))}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
            >
              <Filter className="h-3 w-3" />
              {showMoreFilters ? t('收起筛选', 'Less Filters') : t('风格/场景', 'Style/Scene')}
              <ChevronDown className={`h-3 w-3 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
            </Button>
            {hasActiveFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-6 px-1.5 text-[11px] text-primary"
              >
                {t('重置', 'Reset')}
              </Button>
            )}
          </div>
        </div>

        {/* 展开的风格与场景筛选 */}
        {showMoreFilters && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            {/* 风格行 */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono-label text-[11px] text-muted-foreground w-10 shrink-0">
                {t('风格', 'Style')}:
              </span>
              <FilterChip label={lang === 'en' ? 'All' : '全部'} selected={selectedStyle === 'all'} onClick={() => setSelectedStyle('all')} />
              {grouped.style
                .filter((o) => o.name !== '全部' && o.name_en !== 'All')
                .map((option) => (
                  <FilterChip
                    key={option.id}
                    label={lang === 'en' && option.name_en ? option.name_en : option.name}
                    selected={selectedStyle === option.id}
                    onClick={() => setSelectedStyle(option.id)}
                  />
                ))}
            </div>

            {/* 场景行 */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono-label text-[11px] text-muted-foreground w-10 shrink-0">
                {t('场景', 'Scene')}:
              </span>
              <FilterChip label={lang === 'en' ? 'All' : '全部'} selected={selectedScene === 'all'} onClick={() => setSelectedScene('all')} />
              {grouped.scene
                .filter((o) => o.name !== '全部' && o.name_en !== 'All')
                .map((option) => (
                  <FilterChip
                    key={option.id}
                    label={lang === 'en' && option.name_en ? option.name_en : option.name}
                    selected={selectedScene === option.id}
                    onClick={() => setSelectedScene(option.id)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {filteredCases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground text-sm">{t('暂无匹配的提示词案例', 'No matching prompt cases')}</p>
          <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3">
            {t('重置筛选', 'Reset filters')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCases.map((item) => (
            <PromptCaseCard key={item.id} item={item} lang={lang} onClick={() => setDetailItem(item)} />
          ))}
        </div>
      )}

      {detailItem && (
        <PromptCaseDetail item={detailItem} open onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        selected
          ? 'border-primary bg-primary text-primary-foreground font-medium'
          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function PromptCaseCard({ item, lang, onClick }: { item: PromptCase; lang: string; onClick: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const description = lang === 'en' && item.description_en ? item.description_en : item.description;
  const prompt = lang === 'en' && item.prompt_en ? item.prompt_en : item.prompt;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success(t('已复制提示词', 'Prompt copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('复制失败', 'Copy failed'));
    }
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/60 hover:shadow-lg cursor-pointer"
    >
      <div className={`relative w-full overflow-hidden bg-muted ${aspectClass(item.aspect_ratio)}`}>
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-40" />
          </div>
        ) : (
          <img
            src={item.cover_url}
            alt={title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-4">
          <Button
            size="sm"
            variant="secondary"
            className="w-full gap-1.5 shadow-md bg-background/90 hover:bg-background text-xs"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('已复制', 'Copied') : t('复制提示词', 'Copy Prompt')}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {item.category && <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary">{item.category.name}</Badge>}
          {item.style && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{item.style.name}</Badge>}
        </div>

        <h3 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
