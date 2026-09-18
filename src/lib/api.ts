// @ts-ignore
import { supabase } from '@/db/supabase';
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
  const payload = { ...item };
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
// 三个板块各查各自的表 —— 案例只可能来自 cases、项目只可能来自 projects、
// 活动只可能来自 events，结构上就不存在「类别混乱」的可能。
// 每个板块只取 show_on_home 为真的内容，再按 sort_order 排序取前 N 条。

const HOME_SECTION_LIMIT = 3;

export async function fetchHomeCases(): Promise<CaseItem[]> {
  let query = supabase
    .from('cases')
    .select('*, categories(*)')
    .order('sort_order', { ascending: true })
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
    .order('sort_order', { ascending: true })
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
 * 首页数据带。每项独立容错 —— 任何一项取不到都只显示 0，
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
    .order('sort_order', { ascending: true })
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
  const orderCol = dimension === 'latest' ? 'created_at' : dimension === 'hot' ? 'likes' : 'favorites';
  const { data, error } = await supabase
    .from('cases')
    .select('id, title, title_en, cover_url, likes, favorites, views, base_likes, base_favorites, base_views, created_at')
    .order(orderCol, { ascending: false })
    .limit(8);
  if (error) throw error;
  return safeArray<CaseItem>(data);
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
  const payload = ensureViewCeiling(await stripUnsupportedFields(itemWithoutRelation));
  if (payload.id) {
    const { error } = await supabase.from('cases').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('cases').insert(rest);
    if (error) throw error;
  }
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id);
  if (error) throw error;
}

// ============ Projects ============

// 项目列表/详情可公开读取的列。
// content / content_en / external_url 已在数据库层用「列级权限」收回
// （见 migrations/20260822090300_gate_project_content.sql），
// 这里必须显式列出字段 —— 用 select('*') 会因为触碰到无权限的列而整个请求失败。
const PROJECT_PUBLIC_COLUMNS =
  'id, title, title_en, summary, summary_en, cover_url, video_url, ' +
  'scene, scene_en, maturity, maturity_en, access_level, ' +
  'likes, views, favorites, base_likes, base_favorites, base_views, ' +
  'is_hot, sort_order, created_at, created_by';

/**
 * 「首页展示」字段（show_on_home）是后加的，而本项目的数据库与前端
 * 往往不是同时上线。迁移未执行时，把它写进查询会让整条请求以
 * 42703 column does not exist 失败 —— 项目列表、详情、后台会一起空白。
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

export interface ProjectContent {
  allowed: boolean;
  reason?: 'not_found' | 'insufficient_tier';
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
    .order('sort_order', { ascending: true })
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
  const payload = ensureViewCeiling(await stripUnsupportedFields({ ...item }));
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
  const payload = ensureViewCeiling(await stripUnsupportedFields({ ...item }));
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
    const { error } = await supabase.from('level_config').update({
      title: item.title,
      title_en: item.title_en,
      xp_threshold: item.xp_threshold,
      free_unlock_count: item.free_unlock_count ?? 0,
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
  // 前端补齐缺失 tier 时 id 为空，需要新建记录
  if (!item.id) {
    const { error } = await supabase.from('member_benefits').insert({
      tier: item.tier,
      benefit_key: item.benefit_key,
      benefit_label: item.benefit_label,
      benefit_label_en: item.benefit_label_en,
      enabled: item.enabled,
      sort_order: item.sort_order,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('member_benefits').update({ enabled: item.enabled }).eq('id', item.id);
  if (error) throw error;
}

// ============ Site Content ============
export async function fetchSiteContent(): Promise<SiteContent[]> {
  const { data, error } = await supabase.from('site_content').select('*').order('section', { ascending: true }).limit(200);
  if (error) throw error;
  return safeArray<SiteContent>(data);
}

export async function saveSiteContent(item: SiteContent): Promise<void> {
  const { error } = await supabase.from('site_content').update({ value: item.value, value_en: item.value_en, image_url: item.image_url, updated_at: new Date().toISOString() }).eq('id', item.id);
  if (error) throw error;
}

// ============ Assistant Config ============
export async function fetchAssistantConfig(): Promise<AssistantConfig | null> {
  const { data, error } = await supabase.from('assistant_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveAssistantConfig(item: Partial<AssistantConfig>): Promise<void> {
  if (item.id) {
    const { error } = await supabase.from('assistant_config').update({ ...item, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) throw error;
  } else {
    const { id, ...rest } = item;
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
  if (error) throw error;
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
  const payload = { ...item };
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
  const payload = { ...item };
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
export async function fetchSiteSettings(): Promise<SiteSetting[]> {
  const { data, error } = await supabase.from('site_settings').select('*').order('key', { ascending: true }).limit(100);
  if (error) throw error;
  return safeArray<SiteSetting>(data);
}

export async function saveSiteSetting(item: SiteSetting): Promise<void> {
  const { error } = await supabase.from('site_settings').upsert(
    { key: item.key, value: item.value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
}