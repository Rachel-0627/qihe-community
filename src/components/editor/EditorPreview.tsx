interface EditorPreviewProps {
  title: string;
  summary: string;
  content: string;
  coverUrl?: string;
  author?: string;
}

export default function EditorPreview({ title, summary, content, coverUrl, author }: EditorPreviewProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
      <header>
        <h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-4xl">
          {title || <span className="text-muted-foreground">（未填写标题）</span>}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
          {summary || <span className="text-muted-foreground/60">（未填写摘要）</span>}
        </p>
        {author && (
          <div className="mt-6 flex items-center justify-between border-y border-border py-4">
            <span className="font-mono-label text-xs text-muted-foreground">{author}</span>
          </div>
        )}
      </header>

      {coverUrl && (
        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
          <img src={coverUrl} alt="封面" className="w-full object-cover" />
        </div>
      )}

      {content ? (
        <div className="prose prose-base max-w-none dark:prose-invert mt-10" dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        <p className="mt-10 text-sm text-muted-foreground">（正文为空）</p>
      )}
    </article>
  );
}