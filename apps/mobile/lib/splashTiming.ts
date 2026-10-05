/**
 * 启动页时序 —— 纯逻辑，不依赖 react-native / reanimated，因此可被测试直接钉住。
 *
 * 为什么要单独抽出来：启动页的相位时序出过一次严重事故（见 shouldRunExit 的注释）。
 * 当时这段逻辑埋在组件的 useEffect 里，条件写反了也没有任何测试能发现，
 * 后果是 release 包永久停在启动页。把契约抽成纯函数 + 单测，
 * 是为了让「入场播完才能退场」这条规则变成可断言的东西。
 */

/** 入场总时长（ms），onEntered 在这段时间后触发 */
export const INK_SPLASH_ENTER_MS = 820;

/** 退场时长（ms） */
export const INK_SPLASH_EXIT_MS = 300;

/**
 * 硬性兜底：原生启动页最多存活这么久（ms）。
 * 挂在 app/_layout.tsx 的模块作用域，不受组件生命周期影响 ——
 * 原生启动页一旦留在屏幕上，底下所有界面都看不见，
 * 而 release 包没有红屏浮层，用户只会觉得「应用打不开」。
 */
export const INK_SPLASH_HARD_HIDE_MS = 2500;

/**
 * 退场闸门。
 *
 * 语义：**入场播完之后**才允许开始退场。`active` 由 _layout 传入，
 * 取值是 `phase === "ink"`，而 phase 要等 onEntered 触发后才从 native 变成 ink。
 *
 * 这里曾经写成 `return active === false`，即组件内 `if (active) return;`。
 * 后果：挂载时 active 恰为 false，退场立刻开始，300ms 后 onExited 把组件卸载，
 * 入场动画才播了三分之一；更致命的是 _layout 里负责 hideAsync 的兜底定时器
 * 因 phase !== "native" 被清掉，hideAsync 永不调用，原生启动页永久停留。
 */
export function shouldRunExit(active: boolean): boolean {
  return active === true;
}
