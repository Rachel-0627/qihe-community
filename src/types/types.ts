export type UserRole = 'user' | 'admin';
export type MemberTier = 'guest' | 'explorer' | 'member' | 'pro';
export type CommunityIdentity = 'user' | 'creator' | 'builder' | 'contributor';
export type ContentAccess = 'free' | 'member' | 'pro' | 'private';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  member_tier: MemberTier;
  community_identity: CommunityIdentity;
  xp: number;
  level: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  sort_order: number;
  type: 'case' | 'project' | 'event';
}

export interface CaseItem {
  id: string;
  title: string;
  title_en: string;
  summary: string;
  summary_en: string;
  cover_url: string;
  category_id: string | null;
  content: string;
  content_en: string;
  author: string;
  author_en: string;
  likes: number;
  favorites: number;
  views: number;
  base_likes: number;
  base_favorites: number;
  base_views: number;
  is_featured: boolean;
  /** 是否在首页对应板块展示 */
  show_on_home: boolean;
  sort_order: number;
  created_at: string;
  categories?: Category;
}

export interface ProjectItem {
  id: string;
  title: string;
  title_en: string;
  summary: string;
  summary_en: string;
  cover_url: string;
  // 以下三个字段受数据库列级权限保护，列表/详情查询里不会返回，
  // 需通过 fetchProjectContent() 单独获取，因此标记为可选
  content?: string;
  content_en?: string;
  external_url?: string;
  video_url: string;
  scene: string;
  scene_en: string;
  maturity: string;
  maturity_en: string;
  access_level: ContentAccess;
  likes: number;
  favorites: number;
  views: number;
  base_likes: number;
  base_favorites: number;
  base_views: number;
  is_hot: boolean;
  /** 是否在首页对应板块展示 */
  show_on_home: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

// 保留旧类型用于兼容旧数据的渲染回退
export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'image' | 'quote';
  text?: string;
  url?: string;
  caption?: string;
}

export interface EventItem {
  id: string;
  title: string;
  title_en: string;
  summary: string;
  summary_en: string;
  cover_url: string;
  city: string;
  city_en: string;
  theme: string;
  theme_en: string;
  location: string;
  location_en: string;
  event_date: string;
  capacity: number;
  /** 是否在首页对应板块展示 */
  show_on_home: boolean;
  registered: number;
  likes: number;
  favorites: number;
  views: number;
  base_likes: number;
  base_favorites: number;
  base_views: number;
  sort_order: number;
  created_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  phone: string;
  wechat: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistrationExportRow extends EventRegistration {
  event_title: string;
  event_title_en: string;
  event_date: string;
  city: string;
  theme: string;
  username: string | null;
  nickname: string | null;
  email: string | null;
}

export interface LevelConfig {
  level: number;
  title: string;
  title_en: string;
  xp_threshold: number;
  sort_order: number;
  /** 该等级可免费解锁的付费项目数量 */
  free_unlock_count: number;
}

export interface UnlockCountResult {
  total: number;
  used: number;
  remaining: number;
}

export interface UnlockProjectResult {
  success: boolean;
  reason?: 'not_found' | 'not_authenticated' | 'free_content' | 'admin' | 'tier' | 'already_unlocked' | 'no_quota' | 'quota_used';
  remaining?: number;
}

export interface MemberBenefit {
  id: string;
  tier: MemberTier;
  benefit_key: string;
  benefit_label: string;
  benefit_label_en: string;
  enabled: boolean;
  sort_order: number;
}

export interface SiteContent {
  id: string;
  section: string;
  key: string;
  value: string;
  value_en: string;
  image_url: string;
  updated_at: string;
}

export interface AssistantConfig {
  id: string;
  persona_name: string;
  persona_name_en: string;
  system_prompt: string;
  system_prompt_en: string;
  greeting: string;
  greeting_en: string;
  updated_at: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string;
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  xp_awarded: number;
  created_at: string;
}

export interface ProjectFilterOption {
  id: string;
  group: 'scene' | 'maturity' | 'category';
  name: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface EventFilterOption {
  id: string;
  group: 'city' | 'theme';
  name: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: string;
  updated_at: string;
}