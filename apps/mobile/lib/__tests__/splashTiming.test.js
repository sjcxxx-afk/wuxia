/**
 * 启动页相位时序回归测试。
 *
 * 真实事故：release 包安装后「打不开」，永远停在启动页 —— 宣纸底 + 一个木匣标记，
 * 「物匣」标题、副标题、底部导航栏全都看不到。根因是退场闸门条件写反：
 * 组件内写成 `if (active) return;`，而挂载时 active 恰为 false，
 * 于是 InkSplash 立刻开始退场，300ms 后被卸载；连带把 app/_layout.tsx 里
 * 负责 hideAsync 的兜底定时器一起丢掉，原生启动页永久留在屏幕上。
 * release 包没有红屏浮层，所以用户看到的只是「打不开」。
 */
const {
  shouldRunExit,
  INK_SPLASH_ENTER_MS,
  INK_SPLASH_EXIT_MS,
  INK_SPLASH_HARD_HIDE_MS,
} = require("../splashTiming");

describe("退场闸门 shouldRunExit", () => {
  it("挂载时（active=false）绝不能开始退场 —— 本次事故的根因", () => {
    expect(shouldRunExit(false)).toBe(false);
  });

  it("入场播完（active=true）才允许退场", () => {
    expect(shouldRunExit(true)).toBe(true);
  });

  it("只认严格 true，避免 undefined 被当成真", () => {
    expect(shouldRunExit(undefined)).toBe(false);
    expect(shouldRunExit(null)).toBe(false);
    expect(shouldRunExit(0)).toBe(false);
    expect(shouldRunExit("true")).toBe(false);
  });
});

describe("启动页时序常量", () => {
  it("入场 + 退场 必须短于硬兜底，否则退场会被兜底打断", () => {
    expect(INK_SPLASH_ENTER_MS).toBeGreaterThan(0);
    expect(INK_SPLASH_EXIT_MS).toBeGreaterThan(0);
    expect(INK_SPLASH_ENTER_MS + INK_SPLASH_EXIT_MS).toBeLessThan(INK_SPLASH_HARD_HIDE_MS);
  });

  it("硬兜底不超过 3s —— 再慢用户就真以为打不开了", () => {
    expect(INK_SPLASH_HARD_HIDE_MS).toBeGreaterThan(0);
    expect(INK_SPLASH_HARD_HIDE_MS).toBeLessThanOrEqual(3000);
  });

  it("入场时长要够看（至少 500ms），否则品牌表达一闪而过", () => {
    expect(INK_SPLASH_ENTER_MS).toBeGreaterThanOrEqual(500);
  });
});

describe("相位推演：正常路径必须走完 native → ink → gone", () => {
  function run(activeAtEntry, activeAfterEnter) {
    const calls = [];
    let exitFired = false;

    // 挂载时跑一次退场 effect
    if (shouldRunExit(activeAtEntry)) {
      calls.push("exit@mount");
      exitFired = true; // 300ms 后 onExited
    }
    calls.push("enter-start");

    // 820ms 后 onEntered → phase 变 ink → active 变 true → 退场 effect 重跑
    calls.push("onEntered", "hideAsync");
    if (shouldRunExit(activeAfterEnter)) {
      calls.push("exit@ink");
    } else {
      exitFired = false;
    }
    return { calls, exitFired };
  }

  it("挂载时 active=false、播完转 true —— 退场只在播完后发生一次", () => {
    const r = run(false, true);
    expect(r.calls).toEqual(["enter-start", "onEntered", "hideAsync", "exit@ink"]);
  });

  it("回归：挂载时若误判为可退场，退场会早于 onEntered", () => {
    // 这就是事故现场：条件写反时 activeAtEntry 会是 true
    const buggy = run(true, true);
    expect(buggy.calls.indexOf("exit@mount")).toBeLessThan(buggy.calls.indexOf("onEntered"));
    // 正确实现下这个顺序不可能出现
    const correct = run(false, true);
    expect(correct.calls.indexOf("exit@mount")).toBe(-1);
  });
});
