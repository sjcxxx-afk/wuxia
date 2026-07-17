/**
 * Check: Android OCR should use bundled Chinese ML Kit (not Play Services download).
 * Run: node apps/mobile/scripts/repro-ocr-optional-module.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gradlePath = path.resolve(
  __dirname,
  "../node_modules/@zhanziyang/expo-text-extractor/android/build.gradle"
);
const patchPath = path.resolve(
  __dirname,
  "../patches/@zhanziyang+expo-text-extractor+1.0.2.patch"
);

const gradle = fs.readFileSync(gradlePath, "utf8");
const patch = fs.existsSync(patchPath) ? fs.readFileSync(patchPath, "utf8") : "";

const usesUnbundledChinese = /play-services-mlkit-text-recognition-chinese/.test(gradle);
const usesBundledChinese = /com\.google\.mlkit:text-recognition-chinese/.test(gradle);
const patchHasBundled = /com\.google\.mlkit:text-recognition-chinese/.test(patch);

console.log("build.gradle:");
console.log("  unbundled play-services chinese:", usesUnbundledChinese);
console.log("  bundled mlkit chinese:", usesBundledChinese);
console.log("patch includes bundled chinese:", patchHasBundled);

if (usesUnbundledChinese || !usesBundledChinese || !patchHasBundled) {
  console.error("RED: still on unbundled optional-module path");
  process.exit(1);
}
console.log("GREEN: bundled Chinese OCR model wired for APK rebuild");
process.exit(0);
