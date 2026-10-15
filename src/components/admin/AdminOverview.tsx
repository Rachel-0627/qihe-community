import {
  ArrowRight,
  CircleUserRound,
  FilePenLine,
  Files,
  Inbox,
  LayoutDashboard,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import { fetchHomeStats } from '@/lib/api';
import { countPendingSubmissions } from '@/lib/submissionsApi';

type AdminDestination = 'content' | 'submissions' | 'copywriting' | 'accounts';

interface AdminOverviewProps {
  onNavigate: (destination: AdminDestination) => void;
}

interface OverviewStats {
  pending: number;
  cases: number;
  projects: number;
  events: number;
}

export default function AdminOverview({ onNavigate }: AdminOverviewProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([countPendingSubmissions(), fetchHomeStats()])
      .then(([pending, content]) => {
        if (active) {
          setStats({
            pending,
            cases: content.cases,
            projects: content.projects,
            events: content.events,
          });
        }
      })
      .catch(() => {
        if (active) setStats({ pending: 0, cases: 0, projects: 0, events: 0 });
      });
    return () => { active = false; };
  }, []);

  const actions = [
    {
      key: 'submissions' as const,
      eyebrow: t('优先处理', 'Priority'),
      title: t('审核用户投稿', 'Review submissions'),
      description: t('集中处理待审核、已通过与已驳回内容。', 'Review pending, approved, and rejected submissions.'),
      icon: Inbox,
      count: stats?.pending,
      countLabel: t('条待审核', 'pending'),
      emphasized: true,
    },
    {
      key: 'content' as const,
      eyebrow: t('内容运营', 'Content'),
      title: t('管理社区内容', 'Manage content'),
      description: t('维护案例、项目、活动、广场与工具。', 'Maintain cases, projects, events, plaza, and tools.'),
      icon: Files,
    },
    {
      key: 'copywriting' as const,
      eyebrow: t('全站呈现', 'Site'),
      title: t('调整页面与文案', 'Edit pages and copy'),
      description: t('修改品牌、导航、首页和页脚，并明确查看影响范围。', 'Edit branding, navigation, homepage, and footer copy.'),
      icon: FilePenLine,
    },
    {
      key: 'accounts' as const,
      eyebrow: t('协作管理', 'Access'),
      title: t('管理账号与权限', 'Manage accounts'),
      description: t('管理员与普通用户分开管理。', 'Manage administrators and members separately.'),
      icon: CircleUserRound,
    },
  ];

  return (
    <div className="space-y-10">
      <section className="overflow-hidden border border-border bg-card">
        <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-accent">
              <LayoutDashboard className="h-4 w-4" />
              <p className="font-mono-label text-xs uppercase tracking-[0.18em]">{t('今日工作台', 'Today')}</p>
            </div>
            <h2 className="mt-4 max-w-2xl font-display text-2xl font-medium leading-tight md:text-3xl">
              {t('先处理待办，再维护内容。', 'Start with pending work, then maintain the site.')}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              {t('后台按照你真正要完成的工作组织，不再从数据库字段开始。', 'The console is organized around real management tasks instead of database fields.')}
            </p>
          </div>
          <div className="grid grid-cols-3 border-t border-border bg-muted/25 lg:border-l lg:border-t-0">
            {[
              [stats?.cases, t('案例', 'Cases')],
              [stats?.projects, t('项目', 'Projects')],
              [stats?.events, t('活动', 'Events')],
            ].map(([value, label]) => (
              <div key={String(label)} className="flex min-h-28 flex-col items-center justify-center border-r border-border p-3 text-center last:border-r-0 lg:border-b lg:border-r-0 lg:last:border-b-0">
                <strong className="font-display text-2xl font-medium text-foreground">{value ?? '—'}</strong>
                <span className="mt-1 font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="editorial-label text-accent">{t('快捷入口', 'Quick actions')}</p>
            <h2 className="mt-1 font-display text-xl font-medium">{t('你现在要做什么？', 'What do you want to do?')}</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => onNavigate(action.key)}
                className={`group flex min-h-44 flex-col border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${action.emphasized ? 'border-primary/50 bg-primary text-primary-foreground shadow-md' : 'border-border bg-card hover:border-primary/35'}`}
              >
                <div className="flex w-full items-start justify-between gap-4">
                  <span className={`flex h-10 w-10 items-center justify-center border ${action.emphasized ? 'border-primary-foreground/25 bg-primary-foreground/10' : 'border-border bg-muted/40 text-accent'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {action.count !== undefined && (
                    <span className="font-mono-label text-xs">
                      <strong className="mr-1 text-lg">{action.count}</strong>{action.countLabel}
                    </span>
                  )}
                </div>
                <p className={`mt-5 font-mono-label text-[10px] uppercase tracking-[0.16em] ${action.emphasized ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{action.eyebrow}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-medium">{action.title}</h3>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
                <p className={`mt-2 text-sm leading-6 ${action.emphasized ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{action.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 border border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-base font-medium">{t('修改完成后，记得去前台核对实际效果。', 'Check the live site after making changes.')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('页面装修中的内容会直接影响访客看到的页面。', 'Page settings directly affect what visitors see.')}</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/', '_blank', 'noopener,noreferrer')} className="shrink-0 font-mono-label text-xs">
          {t('打开前台', 'Open site')}<ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </section>
    </div>
  );
}
