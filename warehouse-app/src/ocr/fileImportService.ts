/**
 * CSV / Excel 导入服务
 * 
 * 支持从购物平台导出的订单 CSV 或 Excel 文件中批量解析购买信息。
 * 自动识别常见平台的列名映射。
 */

import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

export interface ImportRow {
  name: string;
  brand: string;
  purchasePrice: number;
  purchasePlatform: string;
  storeName: string;
  purchaseDate: string;
  quantity: number;
}

interface ColumnMap {
  name: string[];
  brand: string[];
  purchasePrice: string[];
  purchasePlatform: string[];
  storeName: string[];
  purchaseDate: string[];
  quantity: string[];
}

/**
 * 各平台常见列名映射（不区分大小写）
 */
const COLUMN_MAPS: ColumnMap = {
  name: [
    "商品名称", "商品", "产品名称", "宝贝名称", "商品标题", "名称",
    "product name", "name", "title", "item", "product",
  ],
  brand: [
    "品牌", "品牌名称", "brand",
  ],
  purchasePrice: [
    "实付款", "实付金额", "成交价", "单价", "价格", "商品单价", "金额",
    "应付金额", "支付金额", "price", "amount", "total",
  ],
  purchasePlatform: [
    "平台", "购买平台", "来源", "platform", "source",
  ],
  storeName: [
    "店铺名称", "店铺", "卖家", "商家", "shop", "store", "seller",
  ],
  purchaseDate: [
    "下单时间", "购买时间", "成交时间", "支付时间", "订单创建时间",
    "创建时间", "时间", "日期", "date", "time", "order date",
  ],
  quantity: [
    "数量", "购买数量", "件数", "quantity", "qty", "count",
  ],
};

/**
 * 匹配列名到字段
 */
function matchColumn(header: string): keyof ImportRow | null {
  const h = header.trim();
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    for (const alias of aliases) {
      if (h === alias || h.toLowerCase() === alias.toLowerCase()) {
        return field as keyof ImportRow;
      }
    }
  }
  return null;
}

/**
 * 简易 CSV 解析（支持引号包裹字段）
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    if (fields.length > 0) rows.push(fields);
  }
  return rows;
}

/**
 * 从行列数据中解析导入行
 */
function parseRows(headers: string[], rows: string[][]): ImportRow[] {
  // 建立列映射
  const colIndex: Partial<Record<keyof ImportRow, number>> = {};
  for (let i = 0; i < headers.length; i++) {
    const field = matchColumn(headers[i]);
    if (field && colIndex[field] === undefined) {
      colIndex[field] = i;
    }
  }

  // 检查是否至少识别到商品名称列
  if (colIndex.name === undefined) {
    throw new Error(
      "未识别到商品名称列。\n请确保 CSV 包含以下列之一：" +
      COLUMN_MAPS.name.join("、")
    );
  }

  const results: ImportRow[] = [];
  for (const row of rows) {
    if (row.length === 0) continue;

    const getVal = (field: keyof ImportRow): string => {
      const idx = colIndex[field];
      if (idx === undefined || idx >= row.length) return "";
      return row[idx];
    };

    const name = getVal("name");
    if (!name) continue; // 跳过空名称行

    const priceStr = getVal("purchasePrice").replace(/[¥￥,$\s]/g, "");
    const qtyStr = getVal("quantity");

    results.push({
      name,
      brand: getVal("brand"),
      purchasePrice: parseFloat(priceStr) || 0,
      purchasePlatform: getVal("purchasePlatform") || inferPlatform(headers, row),
      storeName: getVal("storeName"),
      purchaseDate: normalizeDate(getVal("purchaseDate")),
      quantity: parseInt(qtyStr) || 1,
    });
  }

  return results;
}

/**
 * 推断平台（根据列头或数据内容）
 */
function inferPlatform(headers: string[], row: string[]): string {
  const allText = [...headers, ...row].join(" ").toLowerCase();
  if (allText.includes("京东") || allText.includes("jd.com")) return "京东";
  if (allText.includes("淘宝") || allText.includes("taobao")) return "淘宝";
  if (allText.includes("天猫") || allText.includes("tmall")) return "淘宝";
  if (allText.includes("拼多多") || allText.includes("pinduoduo")) return "拼多多";
  if (allText.includes("抖音")) return "抖音";
  return "";
}

/**
 * 标准化日期格式
 */
function normalizeDate(raw: string): string {
  if (!raw) return "";
  const d = raw.trim();
  const m1 = d.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  }
  const m2 = d.match(/(\d{4})(\d{2})(\d{2})/);
  if (m2) {
    return `${m2[1]}-${m2[2]}-${m2[3]}`;
  }
  return d;
}

/**
 * 从文件 URI 导入 CSV
 */
export async function importCSV(fileUri: string): Promise<ImportRow[]> {
  const content = await FileSystem.readAsStringAsync(fileUri);
  const rows = parseCSV(content);
  if (rows.length < 2) {
    throw new Error("CSV 文件为空或只有表头");
  }
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return parseRows(headers, dataRows);
}

/**
 * 从文件 URI 导入 Excel (.xlsx / .xls)
 */
export async function importExcel(fileUri: string): Promise<ImportRow[]> {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: "base64" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel 文件中没有工作表");
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error("Excel 文件为空或只有表头");
  }

  const headers = jsonData[0].map((h: any) => String(h ?? ""));
  const dataRows = jsonData.slice(1).map((row: any[]) =>
    row.map((cell: any) => String(cell ?? ""))
  );

  return parseRows(headers, dataRows);
}

/**
 * 根据文件扩展名自动选择解析方式
 */
export async function importFile(fileUri: string, fileName: string): Promise<ImportRow[]> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return importCSV(fileUri);
  }
  if (ext === "xlsx" || ext === "xls") {
    return importExcel(fileUri);
  }
  throw new Error(`不支持的文件格式: .${ext}，请选择 .csv 或 .xlsx 文件`);
}
