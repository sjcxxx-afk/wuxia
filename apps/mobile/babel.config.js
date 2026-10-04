/**
 * Babel 配置 —— 物匣
 *
 * 为什么必须显式建这个文件（Phase 0 实测结论）：
 *   babel-preset-expo **不会**自动注入 react-native 的 worklets 插件
 *   （已在 node_modules/babel-preset-expo 全量搜索 "worklet" / "reanimated"，0 命中）。
 *   而 Reanimated 4 的 worklet 函数依赖 babel 插件把「普通函数」改写成
 *   worklet 可序列化闭包；插件缺失时不会在编译期报错，而是**运行时**才炸
 *   （worklet 报 "Tried to synchronously call a non-worklet function"，
 *   release 包里没有红屏浮层，表现就是启动即崩）。
 *
 *   插件必须放在 plugins 数组的**最后**——它依赖前面插件的产物做函数边界改写。
 *
 * 校验方式：改完后跑 `npx expo export --platform android`，
 * 产物 bundle 里应能搜到 `__workletHash`。
 */

/** @type {import('@babel/core').ConfigFunction} */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
