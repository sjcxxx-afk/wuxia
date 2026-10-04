const {
  checkReactRendererPin,
  checkSdkMajorLines,
  checkDuplicatedNativeModules,
  collectProblems,
} = require("../check-dependency-matrix");

/** 取自 node_modules/react-native 的 renderer 实现（节选，保留真实断言形态） */
const RENDERER_SRC = `
var isomorphicReactPackageVersion = React.version;
if ("19.2.3" !== isomorphicReactPackageVersion)
  throw Error(
    'Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version.',
  );
`;

const MATRIX = {
  react: "19.2.3",
  "expo-secure-store": "~56.0.4",
  "react-native-gesture-handler": "~2.31.1",
  "react-native-screens": "~4.26.0",
  expo: "~56.0.23",
};

describe("checkReactRendererPin", () => {
  it("react 与 renderer 断言版本一致时通过", () => {
    const { problems } = checkReactRendererPin({
      rendererSources: [RENDERER_SRC],
      reactVersion: "19.2.3",
    });
    expect(problems).toEqual([]);
  });

  it("抓到 2026-10 那次事故：react 19.2.8 撞上 renderer 要求的 19.2.3", () => {
    const { problems } = checkReactRendererPin({
      rendererSources: [RENDERER_SRC],
      reactVersion: "19.2.8",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("react@19.2.8");
    expect(problems[0]).toContain("19.2.3");
  });

  it("renderer 里没有断言时跳过而不是误报", () => {
    const { problems, note } = checkReactRendererPin({
      rendererSources: ["var x = 1;"],
      reactVersion: "19.2.8",
    });
    expect(problems).toEqual([]);
    expect(note).toMatch(/跳过/);
  });
});

describe("checkSdkMajorLines", () => {
  it("同一 SDK 大版本内的补丁号漂移不算问题", () => {
    const { problems } = checkSdkMajorLines({
      matrix: MATRIX,
      installed: { expo: "56.0.20", react: "19.2.3" },
    });
    expect(problems).toEqual([]);
  });

  it("抓到 SDK 56 里装了 57 的 expo-secure-store", () => {
    const { problems } = checkSdkMajorLines({
      matrix: MATRIX,
      installed: { "expo-secure-store": "57.0.2" },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("expo-secure-store@57.0.2");
  });

  it("抓到 gesture-handler 3.x 这种跨大版本", () => {
    const { problems } = checkSdkMajorLines({
      matrix: MATRIX,
      installed: { "react-native-gesture-handler": "3.2.1" },
    });
    expect(problems).toHaveLength(1);
  });

  it("没安装的包不报错", () => {
    const { problems } = checkSdkMajorLines({
      matrix: { "expo-camera": "~56.0.8" },
      installed: {},
    });
    expect(problems).toEqual([]);
  });
});

describe("checkDuplicatedNativeModules", () => {
  it("原生模块只有一份时通过", () => {
    const { problems } = checkDuplicatedNativeModules({
      lockPackages: {
        "node_modules/react-native-screens": { version: "4.26.2" },
        "node_modules/expo-router": { version: "56.2.19" },
      },
    });
    expect(problems).toEqual([]);
  });

  it("抓到 react-native-screens 被装成 4.25.2 + 嵌套 4.27.0", () => {
    const { problems } = checkDuplicatedNativeModules({
      lockPackages: {
        "node_modules/react-native-screens": { version: "4.25.2" },
        "node_modules/expo-router/node_modules/react-native-screens": {
          version: "4.27.0",
        },
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("4.25.2");
    expect(problems[0]).toContain("4.27.0");
  });

  it("非原生模块重复不管（例如不同包各自带一份 lodash）", () => {
    const { problems } = checkDuplicatedNativeModules({
      lockPackages: {
        "node_modules/lodash": { version: "4.17.21" },
        "node_modules/foo/node_modules/lodash": { version: "4.17.20" },
      },
    });
    expect(problems).toEqual([]);
  });
});

describe("collectProblems（当前仓库的真实状态）", () => {
  it("已修复的依赖树整体通过", () => {
    const { readEnvironment } = require("../check-dependency-matrix");
    const env = readEnvironment(require("path").resolve(__dirname, "..", ".."));
    // 只有在 node_modules 已安装时才有意义
    if (env.rendererSources.length === 0) return;
    const { problems } = collectProblems(env);
    expect(problems).toEqual([]);
  });
});
