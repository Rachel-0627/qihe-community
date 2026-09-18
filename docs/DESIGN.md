# Theme Name: 潮流个性
# Vibe & Description: 以高对比配色与硬朗边缘为基础，用巨大字号直陈价值主张，将标准 UI 元素夸张风格化并叠加几何锐线符号，通过无模糊的实心阴影营造强烈触觉深度，在非预期的散落、旋转与堆叠中形成一种玩味而失序的视觉秩序。

# Color
- 主色（霓虹酸柠绿）：#7EFF73，核心高亮
- 辅助色（千禧玫粉）：#FF4B91，撞色搭配
- 强调色（活力柠檬黄）：#FFE135，点缀与提示
# Font
- Heading: DouyinSansBold (url: https://resource-static.cdn.bcebos.com/fonts/DouyinSansBold.woff2)
- Body: 系统默认字体
# Animation
## 元素动画
- 使用更大胆的动效：如卡片上浮，按钮色彩闪烁，悬停时图标旋转/滑入等；
- 按钮点击时会明显下压（transform: translate）。
- 横向滚动的跑马灯文本横幅贯穿页面。
## 入场动画
- 元素从屏幕外滑入，并伴随弹性回弹效果；
## 动画实现
- 项目中集成了 tailwindcss-intersect 插件，可以使用类似下述的方式来实现元素进入视口时的动画效果：
opacity-0 intersect:opacity-100 transition duration-700
- 同时可使用 motion/react 配合实现动画。

# Layout
- 强调视觉层级，标题可做大字号；
- 整体视觉如同由卡片或海报拼贴而成。大量使用粗黑描边（2px–4px）来分隔区域。
- 滚动方式：垂直滚动中混合水平滚动区域，制造节奏变化。

# Elements
- 纯黑色、无模糊的投影，通常向右下偏移 4–8px。
- UI 元素仿佛贴纸一样，被“贴”在画板或墙面上。