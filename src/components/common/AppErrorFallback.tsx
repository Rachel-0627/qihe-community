/**
 * 整站崩溃时的兜底页。
 *
 * 原来这里只有一行裸的 <p>应用发生错误，请刷新页面重试</p>：
 * 没样式、没按钮，用户看到的是白底黑字一句话，连刷新都得自己想。
 *
 * 注意：这个组件挂在 Router 外面（ErrorBoundary 在 App 之上），
 * 所以不能用 react-router 的 Link，只能用原生 <a>。
 * 同理也拿不到 I18nContext，文案直接中英并列。
 */
export default function AppErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-mono-label text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Something went wrong
      </p>

      <h1 className="mt-5 font-display text-2xl font-medium tracking-tight text-foreground md:text-3xl">
        页面出了点问题
      </h1>

      <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground text-pretty">
        刷新一下通常就好了。要是还不行，过几分钟再来试试。
      </p>
      <p className="mt-1 text-sm text-muted-foreground/80">
        Refreshing usually fixes it. If not, please try again in a few minutes.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border border-border bg-foreground px-5 py-2.5 font-mono-label text-xs uppercase tracking-wider text-background transition-opacity hover:opacity-85"
        >
          刷新页面
        </button>
        <a
          href="/"
          className="border border-border px-5 py-2.5 font-mono-label text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          回首页
        </a>
      </div>
    </div>
  );
}
