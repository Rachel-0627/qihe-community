-- 交流与连接：讨论分类、反馈，以及隐私受控的成员连接。
-- 只提交迁移文件；应用前须由项目 Supabase 管理员在合适环境审阅并执行。

UPDATE public.site_settings SET value = '交流与连接'
  WHERE key = 'nav_discuss' AND value IN ('广场', '分享讨论区');
UPDATE public.site_settings SET value = 'Connect & Exchange'
  WHERE key = 'nav_discuss_en' AND value IN ('Plaza', 'Discussion');

ALTER TABLE public.discussion_posts
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '随想交流';
ALTER TABLE public.discussion_posts
  ADD CONSTRAINT discussion_posts_category_check
  CHECK (category IN ('实践分享', '问题求助', '观点讨论', '合作需求', '随想交流'));
ALTER TABLE public.discussion_posts ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.discussion_posts ADD COLUMN IF NOT EXISTS favorites_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.discussion_posts ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- 00043 的策略名留着旧表名前缀，必须先移除；策略默认 OR 连接，漏掉它会让隐藏帖子仍公开。
DROP POLICY IF EXISTS business_posts_read ON public.discussion_posts;
DROP POLICY IF EXISTS discussion_posts_read ON public.discussion_posts;
CREATE POLICY discussion_posts_read ON public.discussion_posts FOR SELECT
  USING (NOT COALESCE(is_hidden, false) OR public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE OR REPLACE FUNCTION public.sync_discussion_category_from_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.kind::text = 'discussion_post' AND NEW.status::text = 'approved' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.discussion_posts SET category = CASE
      WHEN NEW.payload->>'category' IN ('实践分享', '问题求助', '观点讨论', '合作需求', '随想交流') THEN NEW.payload->>'category'
      ELSE '随想交流' END
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_discussion_category_from_submission ON public.content_submissions;
CREATE TRIGGER sync_discussion_category_from_submission
  AFTER INSERT OR UPDATE OF status, payload, target_id ON public.content_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_discussion_category_from_submission();

CREATE TABLE IF NOT EXISTS public.discussion_reactions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('like', 'favorite')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id, kind)
);
UPDATE public.discussion_posts p SET
  likes_count = (SELECT count(*) FROM public.discussion_reactions r WHERE r.post_id = p.id AND r.kind = 'like'),
  favorites_count = (SELECT count(*) FROM public.discussion_reactions r WHERE r.post_id = p.id AND r.kind = 'favorite');
CREATE OR REPLACE FUNCTION public.update_discussion_reaction_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discussion_posts SET likes_count = likes_count + CASE WHEN NEW.kind = 'like' THEN 1 ELSE 0 END,
      favorites_count = favorites_count + CASE WHEN NEW.kind = 'favorite' THEN 1 ELSE 0 END WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  UPDATE public.discussion_posts SET likes_count = GREATEST(0, likes_count - CASE WHEN OLD.kind = 'like' THEN 1 ELSE 0 END),
    favorites_count = GREATEST(0, favorites_count - CASE WHEN OLD.kind = 'favorite' THEN 1 ELSE 0 END) WHERE id = OLD.post_id;
  RETURN OLD;
END $$;
CREATE TRIGGER update_discussion_reaction_counts
  AFTER INSERT OR DELETE ON public.discussion_reactions FOR EACH ROW EXECUTE FUNCTION public.update_discussion_reaction_counts();
ALTER TABLE public.discussion_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY discussion_reactions_read ON public.discussion_reactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY discussion_reactions_insert ON public.discussion_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY discussion_reactions_delete ON public.discussion_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.connection_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  city text NOT NULL DEFAULT '',
  role_title text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  introduction text NOT NULL DEFAULT '',
  homepage_url text NOT NULL DEFAULT '',
  ai_level text NOT NULL DEFAULT '',
  interests text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  resources text[] NOT NULL DEFAULT '{}',
  experience text NOT NULL DEFAULT '',
  current_project text NOT NULL DEFAULT '',
  exploring text NOT NULL DEFAULT '',
  current_needs text[] NOT NULL DEFAULT '{}',
  seeking text[] NOT NULL DEFAULT '{}',
  purposes text[] NOT NULL DEFAULT '{}',
  communication text NOT NULL DEFAULT '线上交流' CHECK (communication IN ('线上交流', '线下交流', '线上与线下均可')),
  discoverable boolean NOT NULL DEFAULT false,
  accept_requests boolean NOT NULL DEFAULT true,
  show_city boolean NOT NULL DEFAULT false,
  show_capabilities boolean NOT NULL DEFAULT true,
  show_needs boolean NOT NULL DEFAULT false,
  open_to_local boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(introduction) <= 600),
  CHECK (char_length(experience) <= 2000),
  CHECK (cardinality(interests) <= 30),
  CHECK (cardinality(skills) <= 30),
  CHECK (cardinality(resources) <= 30),
  CHECK (cardinality(current_needs) <= 30),
  CHECK (cardinality(seeking) <= 30),
  CHECK (cardinality(purposes) <= 12)
);
CREATE INDEX IF NOT EXISTS connection_profiles_discoverable_idx ON public.connection_profiles (discoverable) WHERE discoverable;
ALTER TABLE public.connection_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_profiles_own_read ON public.connection_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY connection_profiles_own_insert ON public.connection_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY connection_profiles_own_update ON public.connection_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id),
  CHECK (char_length(message) <= 500)
);
CREATE INDEX IF NOT EXISTS connection_requests_sender_idx ON public.connection_requests (sender_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS connection_requests_recipient_idx ON public.connection_requests (recipient_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_pending_pair_idx
  ON public.connection_requests (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)) WHERE status = 'pending';
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_requests_participant_read ON public.connection_requests FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.connection_requests FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.connection_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id), CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.connection_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_blocks_own_read ON public.connection_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY connection_blocks_own_insert ON public.connection_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY connection_blocks_own_delete ON public.connection_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.connection_match_feedback (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('hidden', 'interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, candidate_id), CHECK (user_id <> candidate_id)
);
ALTER TABLE public.connection_match_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_match_feedback_own ON public.connection_match_feedback FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.connection_contacts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  wechat text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  other_contact text NOT NULL DEFAULT '',
  share_with_connections boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connection_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_contacts_own_all ON public.connection_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  request_id uuid REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_notifications_user_idx ON public.community_notifications (user_id, created_at DESC);
ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_notifications_read ON public.community_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY community_notifications_update ON public.community_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE UPDATE ON public.community_notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.community_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_connection_contact_share()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.share_with_connections AND (TG_OP = 'INSERT' OR NOT OLD.share_with_connections) THEN
    INSERT INTO public.community_notifications(user_id, kind, actor_id)
    SELECT CASE WHEN r.sender_id = NEW.user_id THEN r.recipient_id ELSE r.sender_id END,
      'contact_shared', NEW.user_id
    FROM public.connection_requests r
    WHERE r.status = 'accepted' AND (r.sender_id = NEW.user_id OR r.recipient_id = NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_connection_contact_share
  AFTER INSERT OR UPDATE OF share_with_connections ON public.connection_contacts
  FOR EACH ROW EXECUTE FUNCTION public.notify_connection_contact_share();

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('discussion', 'member', 'connection')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_reports_submit ON public.community_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_reason_length CHECK (char_length(reason) BETWEEN 5 AND 1000);
CREATE POLICY community_reports_read ON public.community_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY community_reports_admin_update ON public.community_reports FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE TABLE IF NOT EXISTS public.connection_match_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  supply_demand numeric NOT NULL DEFAULT 0.30,
  complementarity numeric NOT NULL DEFAULT 0.25,
  interests numeric NOT NULL DEFAULT 0.20,
  purposes numeric NOT NULL DEFAULT 0.15,
  location_mode numeric NOT NULL DEFAULT 0.10
);
ALTER TABLE public.connection_match_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_match_settings_admin ON public.connection_match_settings FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);
INSERT INTO public.connection_match_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.connection_candidates(p_match_type text DEFAULT '全部推荐', p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (user_id uuid, nickname text, avatar_url text, role_title text, industry text, introduction text,
  city text, interests text[], skills text[], resources text[], needs text[], match_type text, reasons text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_me public.connection_profiles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT * INTO v_me FROM public.connection_profiles WHERE connection_profiles.user_id = v_uid;
  IF NOT FOUND OR NOT v_me.discoverable THEN RETURN; END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT cp.*, p.nickname AS profile_nickname, p.username, p.avatar_url AS profile_avatar,
      ARRAY(SELECT DISTINCT x FROM unnest(v_me.interests) x INTERSECT SELECT DISTINCT x FROM unnest(cp.interests) x) AS shared_interests,
      CASE WHEN cp.show_capabilities THEN ARRAY(SELECT DISTINCT x FROM unnest(v_me.current_needs) x INTERSECT SELECT DISTINCT x FROM unnest(cp.resources) x) ELSE '{}'::text[] END AS supplied,
      CASE WHEN cp.show_needs THEN ARRAY(SELECT DISTINCT x FROM unnest(cp.current_needs) x INTERSECT SELECT DISTINCT x FROM unnest(v_me.resources) x) ELSE '{}'::text[] END AS received,
      CASE WHEN cp.show_needs THEN ARRAY(SELECT DISTINCT x FROM unnest(v_me.skills) x INTERSECT SELECT DISTINCT x FROM unnest(cp.seeking) x) ELSE '{}'::text[] END AS skill_fit,
      ARRAY(SELECT DISTINCT x FROM unnest(v_me.purposes) x INTERSECT SELECT DISTINCT x FROM unnest(cp.purposes) x) AS shared_purposes,
      (v_me.city <> '' AND v_me.city = cp.city AND v_me.show_city AND cp.show_city AND v_me.open_to_local AND cp.open_to_local) AS local_fit
    FROM public.connection_profiles cp JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.user_id <> v_uid AND cp.discoverable AND cp.accept_requests
      AND (cardinality(cp.interests) + cardinality(cp.skills) + cardinality(cp.resources) + cardinality(cp.purposes) > 0)
      AND NOT EXISTS (SELECT 1 FROM public.connection_blocks b WHERE (b.blocker_id = v_uid AND b.blocked_id = cp.user_id) OR (b.blocker_id = cp.user_id AND b.blocked_id = v_uid))
      AND NOT EXISTS (SELECT 1 FROM public.connection_match_feedback f WHERE f.user_id = v_uid AND f.candidate_id = cp.user_id AND f.feedback = 'hidden')
      AND NOT EXISTS (SELECT 1 FROM public.connection_requests r WHERE ((r.sender_id = v_uid AND r.recipient_id = cp.user_id) OR (r.sender_id = cp.user_id AND r.recipient_id = v_uid)) AND r.status IN ('pending','accepted'))
  ), ranked AS (
    SELECT c.*,
      CASE WHEN cardinality(c.supplied) + cardinality(c.received) > 0 THEN '供需匹配'
           WHEN cardinality(c.skill_fit) > 0 THEN '能力互补'
           WHEN c.local_fit THEN '同城匹配' ELSE '兴趣同频' END AS chosen_type,
      w.supply_demand * CASE WHEN cardinality(c.supplied) + cardinality(c.received) > 0 THEN 1 ELSE 0 END
      + w.complementarity * CASE WHEN cardinality(c.skill_fit) > 0 THEN 1 ELSE 0 END
      + w.interests * CASE WHEN cardinality(c.shared_interests) > 0 THEN 1 ELSE 0 END
      + w.purposes * CASE WHEN cardinality(c.shared_purposes) > 0 THEN 1 ELSE 0 END
      + w.location_mode * CASE WHEN c.local_fit THEN 1 ELSE 0 END AS score
    FROM candidates c CROSS JOIN public.connection_match_settings w
  )
  SELECT r.user_id, COALESCE(NULLIF(r.profile_nickname,''), r.username, '社区成员'), r.profile_avatar,
    r.role_title, r.industry, r.introduction,
    CASE WHEN r.show_city THEN r.city ELSE '' END,
    r.interests,
    CASE WHEN r.show_capabilities THEN r.skills ELSE '{}'::text[] END,
    CASE WHEN r.show_capabilities THEN r.resources ELSE '{}'::text[] END,
    CASE WHEN r.show_needs THEN r.current_needs ELSE '{}'::text[] END,
    r.chosen_type,
    array_remove(ARRAY[
      CASE WHEN cardinality(r.supplied)>0 THEN '对方可提供你正在寻找的资源：' || array_to_string(r.supplied, '、') END,
      CASE WHEN cardinality(r.received)>0 THEN '你可提供对方正在寻找的资源：' || array_to_string(r.received, '、') END,
      CASE WHEN cardinality(r.skill_fit)>0 THEN '你的技能符合对方寻找的合作能力' END,
      CASE WHEN cardinality(r.shared_interests)>0 THEN '共同兴趣：' || array_to_string(r.shared_interests, '、') END,
      CASE WHEN r.local_fit THEN '你们在同一城市，且都愿意线下交流' END
    ], NULL)
  FROM ranked r WHERE r.score > 0 AND (p_match_type = '全部推荐' OR r.chosen_type = p_match_type)
  ORDER BY r.score DESC, r.updated_at DESC LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0);
END $$;
REVOKE ALL ON FUNCTION public.connection_candidates(text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.connection_candidates(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.connection_request_action(p_action text, p_target uuid DEFAULT NULL, p_request uuid DEFAULT NULL, p_purpose text DEFAULT '', p_message text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_request public.connection_requests; v_new_request uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_action = 'send' THEN
    IF p_target IS NULL OR p_target = v_uid OR char_length(p_message) > 500 THEN RAISE EXCEPTION '申请信息无效'; END IF;
    IF (SELECT count(*) FROM public.connection_requests WHERE sender_id=v_uid AND created_at > now() - interval '24 hours') >= 20 THEN RAISE EXCEPTION '今日连接申请已达上限，请明天再试'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(LEAST(v_uid::text,p_target::text)||GREATEST(v_uid::text,p_target::text),0));
    IF NOT EXISTS (SELECT 1 FROM public.connection_profiles WHERE user_id=p_target AND discoverable AND accept_requests) THEN RAISE EXCEPTION '对方目前未开放连接申请'; END IF;
    IF EXISTS (SELECT 1 FROM public.connection_blocks WHERE (blocker_id=v_uid AND blocked_id=p_target) OR (blocker_id=p_target AND blocked_id=v_uid)) THEN RAISE EXCEPTION '当前无法向该成员发送申请'; END IF;
    IF EXISTS (SELECT 1 FROM public.connection_requests WHERE status IN ('pending','accepted') AND ((sender_id=v_uid AND recipient_id=p_target) OR (sender_id=p_target AND recipient_id=v_uid))) THEN RAISE EXCEPTION '已有待处理申请或已建立连接'; END IF;
    INSERT INTO public.connection_requests(sender_id,recipient_id,purpose,message) VALUES(v_uid,p_target,p_purpose,left(trim(p_message),500)) RETURNING id INTO v_new_request;
    INSERT INTO public.community_notifications(user_id,kind,request_id,actor_id) VALUES(p_target,'request_received',v_new_request,v_uid);
    RETURN v_new_request;
  ELSIF p_action IN ('accept','reject','withdraw','end') THEN
    SELECT * INTO v_request FROM public.connection_requests WHERE id=p_request FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '连接申请不存在'; END IF;
    IF p_action IN ('accept','reject') AND v_request.recipient_id <> v_uid THEN RAISE EXCEPTION '只有接收方可以处理申请'; END IF;
    IF p_action = 'withdraw' AND v_request.sender_id <> v_uid THEN RAISE EXCEPTION '只有申请人可以撤回'; END IF;
    IF p_action = 'end' AND v_uid NOT IN (v_request.sender_id,v_request.recipient_id) THEN RAISE EXCEPTION '无权结束此连接'; END IF;
    IF p_action IN ('accept','reject','withdraw') AND v_request.status <> 'pending' THEN RAISE EXCEPTION '该申请已处理'; END IF;
    IF p_action = 'end' AND v_request.status <> 'accepted' THEN RAISE EXCEPTION '该连接当前未建立'; END IF;
    IF p_action = 'accept' AND EXISTS (SELECT 1 FROM public.connection_blocks WHERE (blocker_id=v_uid AND blocked_id=v_request.sender_id) OR (blocker_id=v_request.sender_id AND blocked_id=v_uid)) THEN RAISE EXCEPTION '该成员已被屏蔽，无法建立连接'; END IF;
    UPDATE public.connection_requests SET status=CASE p_action WHEN 'accept' THEN 'accepted' WHEN 'reject' THEN 'rejected' WHEN 'withdraw' THEN 'withdrawn' ELSE 'ended' END, updated_at=now() WHERE id=p_request;
    IF p_action IN ('accept','reject') THEN INSERT INTO public.community_notifications(user_id,kind,request_id,actor_id) VALUES(v_request.sender_id,CASE p_action WHEN 'accept' THEN 'request_accepted' ELSE 'request_rejected' END,p_request,v_uid); END IF;
    RETURN p_request;
  END IF;
  RAISE EXCEPTION '不支持的操作';
END $$;
REVOKE ALL ON FUNCTION public.connection_request_action(text, uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.connection_request_action(text, uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.connection_shared_contact(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_contact public.connection_contacts;
BEGIN
  IF v_uid IS NULL OR v_uid = p_user THEN RAISE EXCEPTION '无权读取联系方式'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.connection_requests WHERE status='accepted' AND ((sender_id=v_uid AND recipient_id=p_user) OR (sender_id=p_user AND recipient_id=v_uid))) THEN RAISE EXCEPTION '建立连接并获得对方授权后才能查看联系方式'; END IF;
  IF EXISTS (SELECT 1 FROM public.connection_blocks WHERE (blocker_id=v_uid AND blocked_id=p_user) OR (blocker_id=p_user AND blocked_id=v_uid)) THEN RAISE EXCEPTION '当前无法查看该成员的联系方式'; END IF;
  SELECT * INTO v_contact FROM public.connection_contacts WHERE user_id=p_user AND share_with_connections;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('wechat',v_contact.wechat,'email',v_contact.email,'other_contact',v_contact.other_contact);
END $$;
REVOKE ALL ON FUNCTION public.connection_shared_contact(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.connection_shared_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_community_notification_read(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.community_notifications SET read_at=now() WHERE id=p_id AND user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.mark_community_notification_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_community_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_admin_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_requests bigint; v_accepted bigint;
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN RAISE EXCEPTION '只有管理员可以查看社区统计'; END IF;
  SELECT count(*), count(*) FILTER (WHERE status='accepted') INTO v_requests, v_accepted FROM public.connection_requests;
  RETURN jsonb_build_object(
    'profiles', (SELECT count(*) FROM public.connection_profiles),
    'discoverable', (SELECT count(*) FROM public.connection_profiles WHERE discoverable),
    'requests', v_requests,
    'accepted', v_accepted,
    'acceptance_rate', CASE WHEN v_requests=0 THEN 0 ELSE round(v_accepted::numeric / v_requests * 100, 1) END,
    'discussions', (SELECT count(*) FROM public.discussion_posts),
    'interactions', (SELECT count(*) FROM public.discussion_reactions) + (SELECT count(*) FROM public.post_comments WHERE deleted_at IS NULL)
  );
END $$;
REVOKE ALL ON FUNCTION public.community_admin_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.community_admin_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_member_matching(p_user uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin'::public.user_role THEN RAISE EXCEPTION '只有管理员可以管理成员匹配状态'; END IF;
  UPDATE public.connection_profiles SET discoverable=p_enabled, updated_at=now() WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_member_matching(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_member_matching(uuid, boolean) TO authenticated;

-- 回滚：删除本迁移新增表与函数，并移除 discussion_posts.category；不影响既有帖子及评论。
