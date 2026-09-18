import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NumberFieldProps {
  label: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  actual?: number | null;
  min?: number;
}

/** 后台数字输入框：整行可点击聚焦，加大触控区域 */
export default function NumberField({ label, value, onChange, actual, min = 0 }: NumberFieldProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="block cursor-pointer space-y-1.5 rounded border border-border bg-card p-3 transition-colors hover:border-muted-foreground/30">
      <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {typeof actual === 'number' && (
          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
            ({actual} 实际)
          </span>
        )}
      </span>
      <Input
        id={id}
        type="number"
        min={min}
        value={value ?? 0}
        onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
        className="h-11 px-3 text-base"
      />
    </label>
  );
}
