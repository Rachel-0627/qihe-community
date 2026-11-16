import { discussionBodyParts } from '@/lib/discussionBody';

export default function DiscussionBody({ body }: { body: string }) {
  return <div className="text-base leading-relaxed text-foreground text-pretty">
    {discussionBodyParts(body).map((part, index) => part.type === 'video'
      ? <video key={index} src={part.value} controls playsInline preload="metadata" className="my-4 block max-h-[70vh] w-full border border-border bg-black" />
      : part.type === 'image'
      ? <a key={index} href={part.value} target="_blank" rel="noreferrer" className="my-4 block overflow-hidden border border-border bg-card">
          <img src={part.value} alt="讨论正文配图" loading="lazy" className="w-full object-contain" />
        </a>
      : <span key={index} className="whitespace-pre-line">{part.value}</span>)}
  </div>;
}
