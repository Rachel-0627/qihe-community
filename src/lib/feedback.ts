import { toast } from 'sonner';

/**
 * 失败提示的统一出口。
 *
 * 原来各页面都是一句光秃秃的「加载失败」：既不说是什么没加载出来，
 * 也没给下一步，用户只能自己猜要不要刷新。这里统一成
 * 「说清什么没出来 + 为什么 + 给一个重试按钮」。
 *
 * t 由调用方从 useI18n 传进来，这样中英切换跟着走。
 */
type Translate = (zh: string, en: string) => string;

interface Subject {
  zh: string;
  en: string;
}

/** 内容没取到。retry 传进来就会显示「重试」按钮 */
export function notifyLoadFailed(t: Translate, subject: Subject, retry?: () => void) {
  toast.error(t(`${subject.zh}没加载出来`, `Could not load ${subject.en}`), {
    description: t('可能是网络不稳，稍等一下再试一次', 'The network may be unstable — give it a moment and try again'),
    ...(retry ? { action: { label: t('重试', 'Retry'), onClick: retry } } : {}),
  });
}

/** 用户的动作没成功（点赞、收藏、报名这类） */
export function notifyActionFailed(t: Translate, retry?: () => void) {
  toast.error(t('这一下没成功', "That didn't go through"), {
    description: t('可能是网络不稳，再点一次试试', 'The network may be unstable — try once more'),
    ...(retry ? { action: { label: t('重试', 'Retry'), onClick: retry } } : {}),
  });
}

/** 需要登录才能做的事。带一个直达登录页的入口，省得用户自己找 */
export function notifyNeedLogin(t: Translate) {
  toast.error(t('这一步需要先登录', 'Please sign in first'), {
    description: t('浏览不用登录，点赞、收藏和报名需要', 'Browsing is free — signing in is only needed to like, save and join'),
    action: { label: t('去登录', 'Sign in'), onClick: () => { window.location.href = '/login'; } },
  });
}
