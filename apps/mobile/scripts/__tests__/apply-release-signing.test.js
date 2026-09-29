const {
  applyReleaseSigning,
  MARKER_BEGIN,
} = require("../apply-release-signing");

/** 取自 expo prebuild 实际生成的 android/app/build.gradle（节选） */
const TEMPLATE = `android {
    namespace 'com.sjc.wuxia'
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

describe("applyReleaseSigning", () => {
  it("注入 release 签名配置，并把 release buildType 指向它", () => {
    const { changed, reason, output } = applyReleaseSigning(TEMPLATE);

    expect(changed).toBe(true);
    expect(reason).toBe("patched");
    expect(output).toContain(MARKER_BEGIN);
    expect(output).toContain('storeFile file(System.getenv("WUXIA_KEYSTORE_FILE"))');
    expect(output).toContain('storePassword System.getenv("WUXIA_KEYSTORE_PASSWORD")');
    expect(output).toContain('keyAlias System.getenv("WUXIA_KEY_ALIAS")');
    expect(output).toContain('keyPassword System.getenv("WUXIA_KEY_PASSWORD")');

    const releaseSection = output.slice(
      output.indexOf("release {", output.indexOf("buildTypes {"))
    );
    expect(releaseSection).toContain("signingConfig signingConfigs.release");
    expect(releaseSection).not.toContain("signingConfig signingConfigs.debug");
  });

  it("debug buildType 保持使用 debug 签名", () => {
    const { output } = applyReleaseSigning(TEMPLATE);
    const buildTypesIndex = output.indexOf("buildTypes {");
    const debugSection = output.slice(
      output.indexOf("debug {", buildTypesIndex),
      output.indexOf("release {", buildTypesIndex)
    );
    expect(debugSection).toContain("signingConfig signingConfigs.debug");
  });

  it("幂等：重复注入不会产生第二份配置", () => {
    const once = applyReleaseSigning(TEMPLATE).output;
    const twice = applyReleaseSigning(once);

    expect(twice.changed).toBe(false);
    expect(twice.reason).toBe("already-patched");
    expect(twice.output).toBe(once);
    expect(once.split(MARKER_BEGIN)).toHaveLength(2);
  });

  it("模板缺少 signingConfigs 时抛错", () => {
    expect(() => applyReleaseSigning("android {\n  buildTypes {\n    release {\n    }\n  }\n}")).toThrow(
      /signingConfigs/
    );
  });

  it("release 块未使用 debug 签名时抛错（不误改）", () => {
    const withoutDebugSigning = TEMPLATE.replace(
      "            signingConfig signingConfigs.debug\n            minifyEnabled false",
      "            minifyEnabled false"
    );
    expect(() => applyReleaseSigning(withoutDebugSigning)).toThrow(
      /signingConfig signingConfigs\.debug/
    );
  });

  it("模板已自带 release 签名时不重复注入", () => {
    const withReleaseSigning = TEMPLATE.replace(
      "        debug {",
      "        release {\n            storeFile file('existing.keystore')\n        }\n        debug {"
    );
    const result = applyReleaseSigning(withReleaseSigning);

    expect(result.changed).toBe(false);
    expect(result.reason).toBe("template-already-has-release-signing");
    expect(result.output).toBe(withReleaseSigning);
  });
});
