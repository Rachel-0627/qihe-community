import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventItem } from '@/types/types';

interface EventCalendarProps {
  events: EventItem[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  className?: string;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EventCalendar({ events, selectedDate, onSelectDate, className }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  const eventDays = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const d = new Date(ev.event_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDay = start.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= end.getDate(); d++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    while (days.length % 7 !== 0) days.push(null);
    const result: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [currentMonth]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className={cn('border border-border bg-card p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((d) => addMonths(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[6rem] text-center font-mono-label text-sm">
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
          </span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" className="font-mono-label text-xs" onClick={() => { setCurrentMonth(startOfMonth(today)); onSelectDate(null); }}>
          返回今天
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div key={d} className="py-2 text-center font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
        {weeks.flat().map((day, idx) => {
          if (!day) return <div key={idx} className="aspect-square" />;
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayEvents = eventDays.get(key) || [];
          const hasEvent = dayEvents.length > 0;
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isHovered = hoverDay === key;
          return (
            <div key={idx} className="relative">
              <button
                type="button"
                disabled={!hasEvent}
                onClick={() => onSelectDate(isSelected ? null : day)}
                onMouseEnter={() => hasEvent && setHoverDay(key)}
                onMouseLeave={() => setHoverDay(null)}
                className={cn(
                  'relative flex aspect-square w-full flex-col items-center justify-center rounded-sm border text-sm transition-colors',
                  isSelected && 'border-primary bg-primary text-primary-foreground',
                  !isSelected && hasEvent && 'border-border bg-background text-foreground hover:border-accent hover:text-accent',
                  !isSelected && !hasEvent && 'border-transparent text-muted-foreground/60',
                  isToday && !isSelected && 'ring-1 ring-inset ring-accent'
                )}
              >
                <span>{day.getDate()}</span>
                {hasEvent && (
                  <span className={cn('mt-1 flex h-1.5 w-1.5 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-accent')} />
                )}
              </button>

              {isHovered && hasEvent && (
                <div className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 border border-border bg-popover p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                    <span className="font-mono-label text-xs text-muted-foreground">
                      {day.getMonth() + 1}月{day.getDate()}日
                    </span>
                    <span className="font-mono-label text-xs text-accent">{dayEvents.length} 个活动</span>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 font-mono-label text-xs text-accent">{formatTime(ev.event_date)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-center font-mono-label text-xs text-muted-foreground">+{dayEvents.length - 3} 更多</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="font-mono-label text-xs text-muted-foreground">
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 · {eventDays.get(`${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`)?.length || 0} 个活动
          </p>
        </div>
      )}
    </div>
  );
}
