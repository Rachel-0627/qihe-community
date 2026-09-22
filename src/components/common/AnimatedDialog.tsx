import { useRef, useEffect, type ReactNode, type ComponentPropsWithoutRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';

interface AnimatedDialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  open: boolean;
  children: ReactNode;
}

export function AnimatedDialogContent({ open, children, className, ...props }: AnimatedDialogContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const initialOpenRef = useRef(open);

  useEffect(() => {
    const content = contentRef.current;
    const overlay = overlayRef.current;
    if (!content || !overlay) return;

    if (open) {
      gsap.set(content, { visibility: 'visible', opacity: 0, scale: 0.92, y: 16 });
      gsap.set(overlay, { visibility: 'visible', opacity: 0 });
      gsap.to(overlay, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
      gsap.to(content, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.4,
        ease: 'back.out(1.4)',
        overwrite: true,
      });
    } else if (!initialOpenRef.current) {
      // 初始关闭状态不执行退出动画
      gsap.set(content, { visibility: 'hidden' });
      gsap.set(overlay, { visibility: 'hidden' });
    } else {
      gsap.to(content, {
        opacity: 0,
        scale: 0.96,
        y: 12,
        duration: 0.25,
        ease: 'power2.in',
        overwrite: true,
      });
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => {
          gsap.set(content, { visibility: 'hidden' });
          gsap.set(overlay, { visibility: 'hidden' });
        },
      });
    }
    initialOpenRef.current = false;
  }, [open]);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/80"
        style={{ visibility: open ? 'visible' : 'hidden' }}
      />
      <DialogPrimitive.Content
        ref={contentRef}
        forceMount
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
          className
        )}
        style={{ visibility: open ? 'visible' : 'hidden' }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
