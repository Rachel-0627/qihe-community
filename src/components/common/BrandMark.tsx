import { useId } from 'react';

interface BrandMarkProps {
  /** 图形边长（像素），默认 36 */
  size?: number;
  className?: string;
  /**
   * 单色模式：传入任意 CSS 颜色则不使用品牌渐变。
   * 用于需要压平颜色的场景（如深色蒙层、打印）。
   */
  color?: string;
}

/**
 * 启禾社区标识「环轨双苗」。
 * 与 public/favicon.svg 同源，改动时两边需保持一致。
 */
export default function BrandMark({ size = 36, className, color }: BrandMarkProps) {
  // 同一页面可能出现多个实例，渐变 id 必须唯一，否则后挂载的会覆盖先挂载的
  const gradientId = useId();
  const stroke = color ?? `url(#${gradientId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-110 -162 220 220"
      className={className}
      role="img"
      aria-label="启禾社区"
    >
      {!color && (
        <defs>
          <linearGradient id={gradientId} x1="-110" y1="10" x2="110" y2="-150" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F53DB8" />
            <stop offset=".55" stopColor="#A06BF8" />
            <stop offset="1" stopColor="#895AF6" />
          </linearGradient>
        </defs>
      )}
      <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="0" cy="-52" r="104" strokeWidth="6" />
        <path d="M-88,14 Q0,-16 88,14" strokeWidth="6" />
        <path d="M-18,3 C-19,-14 -20,-34 -16,-58" strokeWidth="6" />
        <path
          transform="translate(-16,-58) rotate(28)"
          d="M0,0 C-15,-20 -15,-46 0,-66 C15,-46 15,-20 0,0Z"
          strokeWidth="6"
        />
        <path
          transform="translate(-19,-32) rotate(-46) scale(.76)"
          d="M0,0 C-15,-20 -15,-46 0,-66 C15,-46 15,-20 0,0Z"
          strokeWidth="7.9"
        />
        <path d="M34,7 C34,-6 34,-18 35,-30" strokeWidth="5" />
        <path
          transform="translate(35,-30) rotate(32) scale(.5)"
          d="M0,0 C-15,-20 -15,-46 0,-66 C15,-46 15,-20 0,0Z"
          strokeWidth="10"
        />
        <path
          transform="translate(33,-16) rotate(-42) scale(.42)"
          d="M0,0 C-15,-20 -15,-46 0,-66 C15,-46 15,-20 0,0Z"
          strokeWidth="11.9"
        />
      </g>
      <g fill={stroke}>
        <circle cx="44" cy="-146" r="7" />
        <circle cx="-99" cy="-84" r="7" />
        <circle cx="-80" cy="15" r="7" />
        <circle cx="100" cy="-25" r="7" />
      </g>
    </svg>
  );
}
