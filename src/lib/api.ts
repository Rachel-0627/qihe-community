// @ts-ignore
import { supabase } from '@/db/supabase';
import { stampChapters } from '@/lib/chapters';
import { rankBy } from '@/lib/ranking';
import type {
  CaseItem,
  Category,
  ProjectItem,
  EventItem,
  LevelConfig,
  MemberBenefit,
  SiteContent,
  AssistantConfig,
  KnowledgeItem,
  ContentAccess,
  MemberTier,
  UserCheckin,
  ProjectFilterOption,
  EventFilterOption,
  SiteSetting,
  EventRegistrationExportRow,
  UnlockCountResult,
  UnlockProjectResult,
  PromptCase,
  PromptCaseFilter,
  PromptCaseFilterGroup,
  PromptCaseGeneration,
  PromptCaseAspectRatio,
} from '@/types/types';

const safeArray = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

function compressImage(file: File, maxWidth = 1080, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context not available')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          resolve(blob);
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const MAX_SIZE = 1024 * 1024;
  let uploadFile: Blob = file;
  let contentType = file.type;
  if (file.size > MAX_SIZE) {
    uploadFile = await compressImage(file);
    contentType = 'image/webp';
  }
  const path = `${userId}/avatar.webp`;
  const { error } = await supabase.storage.from('avatars').upload(path, uploadFile, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  return urlData.publicUrl;
}

export interface ImageProviderConfig {
  provider: string;
  base_url: string;
  model: string;
  protocol?: 'openai' | 'claude' | 'gemini' | string;
  default_size?: string;
  request_body_template?: string;
  protocol_settings?: Record<string, string>;
  has_api_key?: boolean;
  apiKeyConfigured?: boolean;
}

const LOCAL_STORAGE_PROVIDER_PREFIX = 'miaoda_user_img_provider_';

export async function fetchMyImageProviderConfig(): Promise<ImageProviderConfig | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // 1. 优先调用后端 set-image-provider Edge Function (统一经过服务端 Vault + 数据库)
  try {
    const { data, error } = await supabase.functions.invoke('set-image-provider', {
      body: { action: 'get' },
    });
    if (!error && data?.config) {
      const isConfigured = Boolean(data.apiKeyConfigured ?? data.has_api_key);
      return {
        ...data.config,
        has_api_key: isConfigured,
        apiKeyConfigured: isConfigured,
      };
    }
  } catch (err) {
    console.warn('fetch provider via function error, fallback to RPC', err);
  }

  // 2. 备用链路：调用数据库 RPC get_my_image_provider_config()（直接带出 Vault 是否有 key）
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_image_provider_config');
    if (!rpcError && rpcData && typeof rpcData === 'object') {
      const res = rpcData as ImageProviderConfig;
      if (res.provider || res.base_url || res.apiKeyConfigured) {
        return res;
      }
    }
  } catch (err) {
    console.warn('fetch provider via rpc error', err);
  }

  // 3. 最终兜底：直查 user_image_providers 表
  try {
    const { data, error } = await supabase
      .from('user_image_providers')
      .select('provider, base_url, model, protocol, default_size, request_body_template, protocol_settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      has_api_key: false,
      apiKeyConfigured: false,
    };
  } catch {
    return null;
  }
}

export async function saveMyImageProviderConfig(config: ImageProviderConfig & { api_key?: string }): Promise<void> {
  const { data, error } = await supabase.functions.invoke('set-image-provider', {
    body: config,
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      } catch {
        // keep fallback msg
      }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);

  // 保存成功后若成功，服务端数据库与 Vault 已经更新为权威状态
}

export async function generateImage(
  prompt: string,
  promptCaseId?: string,
  size = '1024x1024'
): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt: prompt.trim(), prompt_case_id: promptCaseId, size },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      } catch {
        // keep fallback msg
      }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { url: data.url };
}

export async function fetchPromptCaseGenerations(promptCaseId: string): Promise<PromptCaseGeneration[]> {
  const { data, error } = await supabase
    .from('prompt_case_generations')
    .select('*')
    .eq('prompt_case_id', promptCaseId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function deletePromptCaseGeneration(id: string): Promise<void> {
  const { error } = await supabase.from('prompt_case_generations').delete().eq('id', id);
  if (error) throw error;
}

// 通用文件上传：封面图 / 视频等到 media bucket
export async function uploadMedia(file: File, folder: string, id?: string): Promise<string> {
  const MAX_SIZE = 50 * 1024 * 1024; // 视频上限 50MB，图片仍走压缩
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('仅支持图片或视频文件');

  let uploadFile: Blob = file;
  let contentType = file.type;
  let ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (isImage && file.size > 1024 * 1024) {
    uploadFile = await compressImage(file);
    contentType = 'image/webp';
    ext = 'webp';
  }
  if (file.size > MAX_SIZE) throw new Error('文件大小超过 50MB 限制');

  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${id || 'new'}/${safeName}`;
  const { error } = await supabase.storage.from('media').upload(path, uploadFile, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
  return urlData.publicUrl;
}

// 通过 Edge Function 自动翻译中文为英文
export async function translateZhToEn(q: string): Promise<string> {
  if (!q.trim()) return '';
  const { data, error } = await supabase.functions.invoke('text-translation', {
    body: { q: q.trim() },
  });
  if (error) throw error;
  if (data.error_code) throw new Error(data.error_msg || `API 错误 ${data.error_code}`);
  const result = data.result?.trans_result?.map((r: { dst: string }) => r.dst).join('\n');
  return result || '';
}

const TRANSLATION_CHUNK_SIZE = 1800;

function splitTranslationText(value: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const part of value.split(/(\n+)/)) {
    if (current.length + part.length <= TRANSLATION_CHUNK_SIZE) {
      current += part;
      continue;
    }
    if (current) chunks.push(current);
    if (part.length <= TRANSLATION_CHUNK_SIZE) {
      current = part;
      continue;
    }
    for (let index = 0; index < part.length; index += TRANSLATION_CHUNK_SIZE) {
      chunks.push(part.slice(index, index + TRANSLATION_CHUNK_SIZE));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

/** 翻译长文本，按接口限制分段，保留原有换行。 */
export async function translateZhToEnLong(value: string): Promise<string> {
  const text = value ?? '';
  if (!text.trim()) return '';
  const chunks = splitTranslationText(text);
  return (await Promise.all(chunks.map((chunk) => translateZhToEn(chunk)))).join('');
}

/** 翻译富文本正文，只替换文本节点，避免破坏编辑器生成的 HTML 标签。 */
export async function translateHtmlZhToEn(value: string): Promise<string> {
  const html = value ?? '';
  if (!html.trim() || typeof DOMParser === 'undefined') return translateZhToEnLong(html);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return translateZhToEnLong(html);
  const walker = doc.createTreeWalker(root, 4);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement?.tagName.toLowerCase();
    if (textNode.textContent?.trim() && parent !== 'script' && parent !== 'style') nodes.push(textNode);
    node = walker.nextNode();
  }
  await Promise.all(nodes.map(async (textNode) => {
    textNode.textContent = await translateZhToEnLong(textNode.textContent || '');
  }));
  return root.innerHTML;
}

type TranslationSpec<T> = { zh: keyof T; en: keyof T; html?: boolean };

async function withAutoTranslations<T extends Record<string, unknown>>(item: T, specs: TranslationSpec<T>[]): Promise<T> {
  const translated = await Promise.all(specs.map(async ({ zh, en, html }) => {
    const value = typeof item[zh] === 'string' ? String(item[zh]) : '';
    try {
      const result = html ? await translateHtmlZhToEn(value) : await translateZhToEnLong(value);
      return [en, result] as const;
    } catch {
      // 自动翻译是辅助能力，服务不可用时不能阻断中文内容保存。
      const existing = item[en];
      return [en, typeof existing === 'string' ? existing : ''] as const;
    }
  }));
  return { ...item, ...Object.fromEntries(translated) } as T;
}

// ============ Categories ============
export async function fetchCategories(type?: 'case' | 'project' | 'event'): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(100);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<Category>(data);
}

export async function saveCategory(item: Partial<Category>): Promise<void> {
  const payload = await withAutoTranslations({ ...item }, [{ zh: 'name', en: 'name_en' }]);
  if (payload.id) {
    const { error } = await supabase.from('categories').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('categories').insert(rest);
    if (error) throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ============ Home Highlights ============

// 首页三个板块的数据源。
//
// 三个板块各查各自的表：案例只可能来自 cases、项目只可能来自 projects、
// 活动只可能来自 events，结构上就不存在「类别混乱」的可能。
// 每个板块只取 show_on_home 为真的内容，再按 sort_order 排序取前 N 条。

const HOME_SECTION_LIMIT = 3;

export async function fetchHomeCases(): Promise<CaseItem[]> {
  let query = supabase
    .from('cases')
    .select('*, categories(*)')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(HOME_SECTION_LIMIT);
  if (await supportsShowOnHome()) query = query.eq('show_on_home', true);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<CaseItem>(data);
}

export async function fetchHomeProjects(): Promise<ProjectItem[]> {
  const filtered = await supportsShowOnHome();
  let query = supabase
    .from('projects')
    .select(await projectColumns())
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(HOME_SECTION_LIMIT);
  if (filtered) query = query.eq('show_on_home', true);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<ProjectItem>(data);
}

export async function fetchHomeEvents(): Promise<EventItem[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(HOME_SECTION_LIMIT);
  if (await supportsShowOnHome()) query = query.eq('show_on_home', true);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<EventItem>(data);
}

// ============ Home Stats ============

export interface HomeStats {
  cases: number;
  projects: number;
  events: number;
  /** 案例与项目的累计浏览量。社区初期成员数偏少，用浏览量更能体现活跃度 */
  views: number;
}

/**
 * 首页数据带。每项独立容错：任何一项取不到都只显示 0，
 * 不影响首页其余内容渲染。
 */
export async function fetchHomeStats(): Promise<HomeStats> {
  const countOf = async (table: string): Promise<number> => {
    try {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  // 浏览量需要求和，PostgREST 不直接支持 SUM，取回 views 列在前端累加。
  // 当前数据量在百级，成本可忽略；若将来量级变大，应改为数据库侧聚合函数。
  const sumViews = async (): Promise<number> => {
    try {
      const [c, p, e] = await Promise.all([
        supabase.from('cases').select('views, base_views').limit(500),
        supabase.from('projects').select('views, base_views').limit(500),
        supabase.from('events').select('views, base_views').limit(500),
      ]);
      const add = (rows: unknown) =>
        safeArray<{ views: number | null; base_views: number | null }>(rows).reduce(
          (n, r) => n + (r.views ?? 0) + (r.base_views ?? 0),
          0,
        );
      return add(c.data) + add(p.data) + add(e.data);
    } catch {
      return 0;
    }
  };

  const [cases, projects, events, views] = await Promise.all([
    countOf('cases'),
    countOf('projects'),
    countOf('events'),
    sumViews(),
  ]);

  return { cases, projects, events, views };
}

// ============ Cases ============
export async function fetchCases(categoryId?: string | null): Promise<CaseItem[]> {
  let query = supabase
    .from('cases')
    .select('*, categories(*)')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100);
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<CaseItem>(data);
}

export async function fetchCaseById(id: string): Promise<CaseItem | null> {
  const { data, error } = await supabase
    .from('cases')
    .select('*, categories(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCaseRanking(dimension: 'latest' | 'hot' | 'favorite'): Promise<CaseItem[]> {
  // 原来直接 .order('likes')，只按真实点赞排，忽略了运营基数 base_likes，
  // 于是卡片显示 57 赞、排行榜却写 1 赞，同一篇文章两个数。
  // 现在改为取一批候选再按热度分排序：数据库没法直接按计算式排序。
  // 取 200 条近期内容作为候选：更老的内容经时间衰减后本来也进不了前 8。
  const { data, error } = await supabase
    .from('cases')
    .select('id, title, title_en, cover_url, likes, favorites, views, base_likes, base_favorites, base_views, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return rankBy(safeArray<CaseItem>(data), dimension, 8);
}

function ensureViewCeiling(payload: Record<string, unknown>): Record<string, unknown> {
  // 保证 base_views 不低于 max(base_likes, base_favorites) + 1
  const likes = Math.max(0, Math.floor(Number(payload.base_likes) || 0));
  const favorites = Math.max(0, Math.floor(Number(payload.base_favorites) || 0));
  const views = Math.max(0, Math.floor(Number(payload.base_views) || 0));
  return { ...payload, base_views: Math.max(views, likes + 1, favorites + 1) };
}

export async function saveCase(item: Partial<CaseItem>): Promise<void> {
  // fetchCases / fetchCaseById 用 select('*, categories(*)') 把关联分类作为嵌入对象带回，
  // 它是查询出来的虚拟关联，不是 cases 表的真实列；
  // 原样发回会被 PostgREST 以 PGRST204 "Column 'categories' does not exist" 拒绝。
  const { categories: _embeddedCategory, ...itemWithoutRelation } = item as Partial<CaseItem> & {
    categories?: unknown;
  };
  const translated = await withAutoTranslations(itemWithoutRelation, [
    { zh: 'title', en: 'title_en' },
    { zh: 'summary', en: 'summary_en' },
    { zh: 'content', en: 'content_en', html: true },
    { zh: 'author', en: 'author_en' },
  ]);
  const payload = ensureViewCeiling(await stripUnsupportedFields(translated));
  if (payload.id) {
    const { error } = await supabase.from('cases').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('cases').insert(rest);
    if (error) throw error;
  }
}

// 保存案例并返回 id（新建时返回新记录 id，更新时返回原 id）
export async function saveCaseAndReturn(item: Partial<CaseItem>): Promise<string | undefined> {
  const { categories: _embeddedCategory, ...itemWithoutRelation } = item as Partial<CaseItem> & {
    categories?: unknown;
  };
  const translated = await withAutoTranslations(itemWithoutRelation, [
    { zh: 'title', en: 'title_en' },
    { zh: 'summary', en: 'summary_en' },
    { zh: 'content', en: 'content_en', html: true },
    { zh: 'author', en: 'author_en' },
  ]);
  const payload = ensureViewCeiling(await stripUnsupportedFields(translated));
  if (payload.id) {
    const { error } = await supabase.from('cases').update(payload).eq('id', payload.id);
    if (error) throw error;
    return payload.id as string;
  }
  const { id, ...rest } = payload;
  const { data, error } = await supabase.from('cases').insert(rest).select('id').maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id);
  if (error) throw error;
}

// ============ Projects ============

// 项目列表/详情可公开读取的列。
// content / content_en / external_url 已在数据库层用「列级权限」收回
// （见 migrations/20260822090300_gate_project_content.sql），
// 这里必须显式列出字段：用 select('*') 会因为触碰到无权限的列而整个请求失败。
const PROJECT_PUBLIC_COLUMNS =
  'id, title, title_en, summary, summary_en, cover_url, video_url, ' +
  'scene, scene_en, maturity, maturity_en, access_level, ' +
  'likes, views, favorites, base_likes, base_favorites, base_views, ' +
  'is_hot, is_pinned, sort_order, created_at, created_by';

/**
 * 「首页展示」字段（show_on_home）是后加的，而本项目的数据库与前端
 * 往往不是同时上线。迁移未执行时，把它写进查询会让整条请求以
 * 42703 column does not exist 失败，项目列表、详情、后台会一起空白。
 *
 * 这里探测一次并缓存：字段不存在就自动降级为「全部展示」，页面照常可用；
 * 迁移执行后无需改任何代码，刷新即生效。
 */
let showOnHomeSupported: boolean | null = null;

async function supportsShowOnHome(): Promise<boolean> {
  if (showOnHomeSupported === null) {
    const { error } = await supabase.from('projects').select('show_on_home').limit(1);
    showOnHomeSupported = !error;
  }
  return showOnHomeSupported;
}

/**
 * 写入前剔除数据库还不支持的字段。
 *
 * PostgREST 遇到不存在的列不会忽略，而是整条请求失败
 * （PGRST204 Column ... does not exist），后台会直接报「保存失败」。
 * 迁移执行后此函数自动透传，无需改代码。
 */
async function stripUnsupportedFields<T extends Record<string, unknown>>(payload: T): Promise<T> {
  if (await supportsShowOnHome()) return payload;
  const { show_on_home: _omit, ...rest } = payload as T & { show_on_home?: unknown };
  return rest as unknown as T;
}

/** 给后台用：首页展示开关是否已可用（数据库迁移是否执行过） */
export async function isShowOnHomeReady(): Promise<boolean> {
  return supportsShowOnHome();
}

/** 项目查询用的列清单：字段可用时才带上 show_on_home */
async function projectColumns(): Promise<string> {
  return (await supportsShowOnHome())
    ? `${PROJECT_PUBLIC_COLUMNS}, show_on_home`
    : PROJECT_PUBLIC_COLUMNS;
}

/** 目录项：无论有没有权限，数据库都会返回完整目录 */
export interface ContentChapter {
  /** 永久编号；旧正文（还没盖过章）为 null */
  ch: string | null;
  text: string;
  /** 正文被扣下了，前台显示成锁 */
  locked: boolean;
}

export interface ProjectContent {
  allowed: boolean;
  reason?: 'not_found' | 'insufficient_tier';
  /** true 表示 content 只是试看片段，不是全文 */
  preview?: boolean;
  headings?: ContentChapter[];
  /** 已设为免费试看的章节编号（仅管理员视角有值） */
  preview_chapters?: string[];
  content?: string;
  content_en?: string;
  external_url?: string;
}

export interface EventRegistrationInput {
  name: string;
  phone: string;
  wechat: string;
  note: string;
}

/**
 * 取项目正文与外部链接。
 * 会员等级判定在数据库函数里完成，前端拿不到不该看的内容。
 * 管理员始终可读（后台编辑正文依赖此函数）。
 */
export async function fetchProjectContent(projectId: string): Promise<ProjectContent> {
  const { data, error } = await supabase.rpc('get_project_content', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return data as ProjectContent;
}

/** 获取当前用户剩余免费解锁次数 */
export async function getRemainingUnlockCount(): Promise<UnlockCountResult> {
  const { data, error } = await supabase.rpc('get_remaining_unlock_count');
  if (error) throw error;
  return data as UnlockCountResult;
}

/** 使用免费额度解锁付费项目 */
export async function unlockProjectWithFreeQuota(projectId: string): Promise<UnlockProjectResult> {
  const { data, error } = await supabase.rpc('unlock_project_with_free_quota', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return data as UnlockProjectResult;
}
export async function fetchProjects(filters?: {
  scene?: string;
  maturity?: string;
  hotOnly?: boolean;
}): Promise<ProjectItem[]> {
  let query = supabase
    .from('projects')
    .select(await projectColumns())
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100);
  if (filters?.scene) query = query.eq('scene', filters.scene);
  if (filters?.maturity) query = query.eq('maturity', filters.maturity);
  if (filters?.hotOnly) query = query.eq('is_hot', true);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<ProjectItem>(data);
}

export async function fetchProjectById(id: string): Promise<ProjectItem | null> {
  const { data, error } = await supabase.from('projects').select(await projectColumns()).eq('id', id).maybeSingle();
  if (error) throw error;
  // PROJECT_PUBLIC_COLUMNS 是拼接出来的字符串，TS 拿不到字面量类型，
  // supabase-js 的返回类型会退化成 GenericStringError，这里显式断言回业务类型
  return (data as ProjectItem | null) ?? null;
}

export async function saveProject(item: Partial<ProjectItem>): Promise<void> {
  // 保存时给章节标题盖永久编号：免费试看名单记的是编号，
  // 这样以后插入/删除章节，已勾选的免费章节不会错位到别的内容上
  const translated = await withAutoTranslations({ ...item }, [
    { zh: 'title', en: 'title_en' },
    { zh: 'summary', en: 'summary_en' },
    { zh: 'scene', en: 'scene_en' },
    { zh: 'maturity', en: 'maturity_en' },
    { zh: 'content', en: 'content_en', html: true },
  ]);
  const stamped = { ...translated };
  if (typeof stamped.content === 'string') stamped.content = stampChapters(stamped.content);
  if (typeof stamped.content_en === 'string') stamped.content_en = stampChapters(stamped.content_en);
  const payload = ensureViewCeiling(await stripUnsupportedFields(stamped));
  if (payload.id) {
    const { error } = await supabase.from('projects').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('projects').insert(rest);
    if (error) throw error;
  }
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ============ Events ============
export async function fetchEvents(filters?: { city?: string; theme?: string }): Promise<EventItem[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(100);
  if (filters?.city) query = query.eq('city', filters.city);
  if (filters?.theme) query = query.eq('theme', filters.theme);
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<EventItem>(data);
}

export async function fetchEventById(id: string): Promise<EventItem | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as EventItem | null;
}

export async function incrementContentView(targetType: 'case' | 'project' | 'event', targetId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_content_view', {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  if (error) throw error;
}

export interface EventRegistrationResult {
  success: boolean;
  reason?: 'not_found' | 'already_registered' | 'full' | 'not_registered';
  /** 服务端返回的权威人数，前端直接用它，不要自己 +1/-1 */
  registered?: number;
  capacity?: number;
}

/**
 * 报名活动。
 * 鉴权、查重、容量校验、写入、计数全部在数据库函数里一次事务完成，
 * 不会出现「报名成功但人数没加」这类对不上账的情况。
 * 用户身份取自 JWT，前端无需（也无法）指定 userId。
 */
export async function registerEvent(
  eventId: string,
  input?: EventRegistrationInput,
): Promise<EventRegistrationResult> {
  const { data, error } = await supabase.rpc('register_event', {
    p_event_id: eventId,
    p_name: input?.name ?? '',
    p_phone: input?.phone ?? '',
    p_wechat: input?.wechat ?? '',
    p_note: input?.note ?? '',
  });
  if (error) throw error;
  return data as EventRegistrationResult;
}

/** 取消报名，同样一次事务完成 */
export async function cancelRegistration(eventId: string): Promise<EventRegistrationResult> {
  const { data, error } = await supabase.rpc('cancel_event_registration', { p_event_id: eventId });
  if (error) throw error;
  return data as EventRegistrationResult;
}

export async function getUserRegistrations(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('user_id', userId)
    .limit(100);
  if (error) throw error;
  return safeArray<{ event_id: string }>(data).map((r) => r.event_id);
}

/** 管理员导出某活动的报名人员列表（含联系方式） */
export async function getEventRegistrationExport(eventId: string): Promise<EventRegistrationExportRow[]> {
  const { data, error } = await supabase
    .from('event_registration_export')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  return safeArray<EventRegistrationExportRow>(data);
}

export async function saveEvent(item: Partial<EventItem>): Promise<void> {
  const translated = await withAutoTranslations({ ...item }, [
    { zh: 'title', en: 'title_en' },
    { zh: 'summary', en: 'summary_en' },
    { zh: 'city', en: 'city_en' },
    { zh: 'theme', en: 'theme_en' },
    { zh: 'location', en: 'location_en' },
  ]);
  const payload = ensureViewCeiling(await stripUnsupportedFields(translated));
  if (payload.id) {
    const { error } = await supabase.from('events').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('events').insert(rest);
    if (error) throw error;
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// ============ Interactions (like/favorite) ============
export async function getUserInteractions(userId: string): Promise<{ like: Set<string>; favorite: Set<string> }> {
  const { data, error } = await supabase
    .from('user_interactions')
    .select('target_type, target_id, interaction')
    .eq('user_id', userId)
    .in('target_type', ['case', 'project', 'event'])
    .limit(500);
  if (error) throw error;
  const result: { like: Set<string>; favorite: Set<string> } = { like: new Set(), favorite: new Set() };
  for (const row of safeArray<{ target_type: string; target_id: string; interaction: string }>(data)) {
    const set = result[row.interaction as 'like' | 'favorite'];
    if (set) set.add(row.target_id);
  }
  return result;
}

export async function toggleInteraction(
  userId: string,
  targetType: 'case' | 'project',
  targetId: string,
  interaction: 'like' | 'favorite',
  currentlyActive: boolean,
): Promise<void> {
  if (currentlyActive) {
    const { error } = await supabase
      .from('user_interactions')
      .delete()
      .eq('user_id', userId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('interaction', interaction);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_interactions')
      .insert({ user_id: userId, target_type: targetType, target_id: targetId, interaction });
    if (error) throw error;
  }
}

export interface ToggleInteractionResult {
  action: 'added' | 'removed';
  actor_xp: number;
  owner_xp: number;
  likes: number;
  favorites: number;
  views: number;
}

export async function toggleInteractionV2(
  userId: string,
  targetType: 'case' | 'project' | 'event',
  targetId: string,
  interaction: 'like' | 'favorite',
): Promise<ToggleInteractionResult> {
  const { data, error } = await supabase.rpc('toggle_interaction_v2', {
    p_user_id: userId,
    p_target_type: targetType,
    p_target_id: targetId,
    p_interaction: interaction,
  });
  if (error) throw error;
  return data as ToggleInteractionResult;
}

// ============ Config: Level ============
export async function fetchLevelConfig(): Promise<LevelConfig[]> {
  const { data, error } = await supabase.from('level_config').select('*').order('level', { ascending: true }).limit(20);
  if (error) throw error;
  return safeArray<LevelConfig>(data);
}

export async function saveLevelConfig(items: LevelConfig[]): Promise<void> {
  for (const item of items) {
    const translated = await withAutoTranslations({ ...item }, [{ zh: 'title', en: 'title_en' }]);
    const { error } = await supabase.from('level_config').update({
      title: translated.title,
      title_en: translated.title_en,
      xp_threshold: translated.xp_threshold,
      free_unlock_count: translated.free_unlock_count ?? 0,
    }).eq('level', item.level);
    if (error) throw error;
  }
}

// ============ Config: Member Benefits ============
export async function fetchMemberBenefits(): Promise<MemberBenefit[]> {
  const { data, error } = await supabase.from('member_benefits').select('*').order('sort_order', { ascending: true }).limit(100);
  if (error) throw error;
  return safeArray<MemberBenefit>(data);
}

export async function saveMemberBenefit(item: MemberBenefit): Promise<void> {
  const translated = await withAutoTranslations({ ...item }, [{ zh: 'benefit_label', en: 'benefit_label_en' }]);
  // 前端补齐缺失 tier 时 id 为空，需要新建记录
  if (!item.id) {
    const { error } = await supabase.from('member_benefits').insert({
      tier: item.tier,
      benefit_key: item.benefit_key,
      benefit_label: translated.benefit_label,
      benefit_label_en: translated.benefit_label_en,
      enabled: translated.enabled,
      sort_order: translated.sort_order,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('member_benefits').update({
    benefit_label: translated.benefit_label,
    benefit_label_en: translated.benefit_label_en,
    enabled: translated.enabled,
    sort_order: translated.sort_order,
  }).eq('id', item.id);
  if (error) throw error;
}

// ============ Site Content ============
export async function fetchSiteContent(): Promise<SiteContent[]> {
  const { data, error } = await supabase.from('site_content').select('*').order('section', { ascending: true }).limit(200);
  if (error) throw error;
  return safeArray<SiteContent>(data);
}

export async function saveSiteContent(item: SiteContent): Promise<void> {
  const translated = await withAutoTranslations({ ...item }, [{ zh: 'value', en: 'value_en' }]);
  const { error } = await supabase.from('site_content').update({ value: translated.value, value_en: translated.value_en, image_url: translated.image_url, updated_at: new Date().toISOString() }).eq('id', item.id);
  if (error) throw error;
}

// ============ Assistant Config ============
export async function fetchAssistantConfig(): Promise<AssistantConfig | null> {
  const { data, error } = await supabase.from('assistant_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveAssistantConfig(item: Partial<AssistantConfig>): Promise<void> {
  const translated = await withAutoTranslations({ ...item }, [
    { zh: 'persona_name', en: 'persona_name_en' },
    { zh: 'system_prompt', en: 'system_prompt_en' },
    { zh: 'greeting', en: 'greeting_en' },
  ]);
  if (item.id) {
    const { error } = await supabase.from('assistant_config').update({ ...translated, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = translated;
    const { error } = await supabase.from('assistant_config').insert(rest);
    if (error) throw error;
  }
}

// ============ Knowledge Base ============
export async function fetchKnowledgeBase(): Promise<KnowledgeItem[]> {
  const { data, error } = await supabase.from('knowledge_base').select('*').order('sort_order', { ascending: true }).limit(100);
  if (error) throw error;
  return safeArray<KnowledgeItem>(data);
}

export async function saveKnowledgeItem(item: Partial<KnowledgeItem>): Promise<void> {
  if (item.id) {
    const { error } = await supabase.from('knowledge_base').update(item).eq('id', item.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = item;
    const { error } = await supabase.from('knowledge_base').insert(rest);
    if (error) throw error;
  }
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
  if (error) throw error;
}

// ============ Access helpers ============
export function canAccessContent(tier: MemberTier, access: ContentAccess): boolean {
  if (access === 'free') return true;
  if (access === 'member') return tier === 'member' || tier === 'pro';
  if (access === 'pro') return tier === 'pro';
  return false;
}

export const ACCESS_LABELS: Record<ContentAccess, { zh: string; en: string }> = {
  free: { zh: '免费', en: 'Free' },
  member: { zh: '会员', en: 'Member' },
  pro: { zh: 'Pro', en: 'Pro' },
  private: { zh: '私密', en: 'Private' },
};

export const TIER_LABELS: Record<MemberTier, { zh: string; en: string }> = {
  guest: { zh: '游客', en: 'Guest' },
  explorer: { zh: '探索者', en: 'Explorer' },
  member: { zh: '会员', en: 'Member' },
  pro: { zh: 'Pro', en: 'Pro' },
};

// ============ Admin User Management (Edge Function) ============
export async function invokeAdminUsers<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  });
  if (error) {
    let serverMessage = '';
    if (error.name === 'FunctionsHttpError' && error.context instanceof Response) {
      try {
        const body = await error.context.json() as { error?: unknown };
        if (typeof body.error === 'string') serverMessage = body.error;
      } catch {
        // 响应不是 JSON 时保留 Supabase 原始错误。
      }
    }
    throw new Error(serverMessage || error.message);
  }
  return data as T;
}

// ============ Daily Check-in ============
export async function checkIn(userId: string): Promise<{ success: boolean; already_checked_in?: boolean; xp_awarded: number; total_xp?: number }> {
  const { data, error } = await supabase.rpc('check_in', { p_user_id: userId });
  if (error) throw error;
  return data as { success: boolean; already_checked_in?: boolean; xp_awarded: number; total_xp?: number };
}

export async function fetchTodayCheckin(userId: string): Promise<UserCheckin | null> {
  const { data, error } = await supabase
    .from('user_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('checkin_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============ Project Filter Options ============
export async function fetchProjectFilterOptions(): Promise<ProjectFilterOption[]> {
  const { data, error } = await supabase
    .from('project_filter_options')
    .select('*')
    .order('group', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(200);
  if (error) throw error;
  return safeArray<ProjectFilterOption>(data);
}

export async function saveProjectFilterOption(item: Partial<ProjectFilterOption>): Promise<void> {
  const payload = await withAutoTranslations({ ...item }, [{ zh: 'name', en: 'name_en' }]);
  if (payload.id) {
    const { error } = await supabase.from('project_filter_options').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('project_filter_options').insert(rest);
    if (error) throw error;
  }
}

export async function deleteProjectFilterOption(id: string): Promise<void> {
  const { error } = await supabase.from('project_filter_options').delete().eq('id', id);
  if (error) throw error;
}

// ============ Event Filter Options ============
export async function fetchEventFilterOptions(): Promise<EventFilterOption[]> {
  const { data, error } = await supabase
    .from('event_filter_options')
    .select('*')
    .order('group', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(200);
  if (error) throw error;
  return safeArray<EventFilterOption>(data);
}

export async function saveEventFilterOption(item: Partial<EventFilterOption>): Promise<void> {
  const payload = await withAutoTranslations({ ...item }, [{ zh: 'name', en: 'name_en' }]);
  if (payload.id) {
    const { error } = await supabase.from('event_filter_options').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('event_filter_options').insert(rest);
    if (error) throw error;
  }
}

export async function deleteEventFilterOption(id: string): Promise<void> {
  const { error } = await supabase.from('event_filter_options').delete().eq('id', id);
  if (error) throw error;
}

// ============ Site Settings ============
const SITE_SETTING_EN_KEYS: Record<string, string> = {
  brand_name: 'brand_name_en',
  terms_content: 'terms_content_en',
  privacy_content: 'privacy_content_en',
  nav_home: 'nav_home_en',
  nav_cases: 'nav_cases_en',
  nav_projects: 'nav_projects_en',
  nav_events: 'nav_events_en',
  nav_discuss: 'nav_discuss_en',
  nav_tools: 'nav_tools_en',
  locked_project_dialog_title: 'locked_project_dialog_title_en',
  locked_project_dialog_content: 'locked_project_dialog_content_en',
  footer_tagline: 'footer_tagline_en',
  footer_copyright: 'footer_copyright_en',
  discuss_content: 'discuss_content_en',
  tools_content: 'tools_content_en',
};

export async function fetchSiteSettings(): Promise<SiteSetting[]> {
  const { data, error } = await supabase.from('site_settings').select('*').order('key', { ascending: true }).limit(100);
  if (error) throw error;
  return safeArray<SiteSetting>(data);
}

export async function saveSiteSetting(item: SiteSetting): Promise<void> {
  const englishKey = item.key.endsWith('_en') ? item.key : SITE_SETTING_EN_KEYS[item.key];
  if (item.key.endsWith('_en')) {
    const { error } = await supabase.from('site_settings').upsert(
      { key: item.key, value: item.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
    if (error) throw error;
    return;
  }
  let translated: string | null = null;
  if (englishKey) {
    try {
      translated = item.key === 'discuss_content' || item.key === 'tools_content'
        ? await translateHtmlZhToEn(item.value)
        : await translateZhToEnLong(item.value);
    } catch {
      // 先保证中文设置可以保存；翻译服务恢复后再补齐英文镜像。
    }
  }
  const { error: chineseError } = await supabase.from('site_settings').upsert(
    { key: item.key, value: item.value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (chineseError) throw chineseError;
  if (!englishKey || translated === null) return;
  const { error: englishError } = await supabase.from('site_settings').upsert(
    { key: englishKey, value: translated, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (englishError) throw englishError;
}

// ============ Prompt Case Library ============
export async function fetchPromptCaseFilters(): Promise<PromptCaseFilter[]> {
  const { data, error } = await supabase
    .from('prompt_case_filters')
    .select('*')
    .eq('is_active', true)
    .order('group', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(300);
  if (error) throw error;
  return safeArray<PromptCaseFilter>(data);
}

export async function fetchPromptCases(): Promise<PromptCase[]> {
  const { data, error } = await supabase
    .from('prompt_cases')
    .select('*, category:category_id(*), style:style_id(*), scene:scene_id(*)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return safeArray<PromptCase>(data);
}

export async function fetchAllPromptCases(): Promise<PromptCase[]> {
  const { data, error } = await supabase
    .from('prompt_cases')
    .select('*, category:category_id(*), style:style_id(*), scene:scene_id(*)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return safeArray<PromptCase>(data);
}

export async function savePromptCase(item: Partial<PromptCase>): Promise<void> {
  // fetchPromptCases / fetchAllPromptCases 用 select('*, category:category_id(*), style:style_id(*), scene:scene_id(*)')
  // 把关联对象作为嵌入对象带回，并非 prompt_cases 表真实列；
  // 必须剔除 category, style, scene 虚拟字段，避免 PostgREST PGRST204 报错
  const { category: _c, style: _s, scene: _sc, created_at: _ca, ...cleanItem } = item as Partial<PromptCase> & {
    category?: unknown;
    style?: unknown;
    scene?: unknown;
    created_at?: unknown;
  };
  const translated = await withAutoTranslations(cleanItem, [
    { zh: 'title', en: 'title_en' },
    { zh: 'description', en: 'description_en' },
    { zh: 'prompt', en: 'prompt_en' },
  ]);
  const payload = { ...translated, updated_at: new Date().toISOString() };
  if (payload.id) {
    const { error } = await supabase.from('prompt_cases').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('prompt_cases').insert(rest);
    if (error) throw error;
  }
}

// 快速切换案例置顶状态
export async function toggleCasePinned(id: string, is_pinned: boolean): Promise<void> {
  const { error } = await supabase.from('cases').update({ is_pinned }).eq('id', id);
  if (error) throw error;
}

// 快速切换项目置顶状态
export async function toggleProjectPinned(id: string, is_pinned: boolean): Promise<void> {
  const { error } = await supabase.from('projects').update({ is_pinned }).eq('id', id);
  if (error) throw error;
}

export async function deletePromptCase(id: string): Promise<void> {
  const { error } = await supabase.from('prompt_cases').delete().eq('id', id);
  if (error) throw error;
}

export async function savePromptCaseFilter(item: Partial<PromptCaseFilter>): Promise<void> {
  const payload = await withAutoTranslations({ ...item }, [{ zh: 'name', en: 'name_en' }]);
  if (payload.id) {
    const { error } = await supabase.from('prompt_case_filters').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('prompt_case_filters').insert(rest);
    if (error) throw error;
  }
}

export async function deletePromptCaseFilter(id: string): Promise<void> {
  const { error } = await supabase.from('prompt_case_filters').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadPromptCaseCover(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `prompt-cases/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('public-assets').getPublicUrl(path);
  return data.publicUrl;
}
