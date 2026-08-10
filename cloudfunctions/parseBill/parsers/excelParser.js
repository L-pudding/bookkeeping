/**
 * excelParser.js - Excel 文件解析器
 *
 * 使用 SheetJS (xlsx) 库把 .xlsx/.xls 文件转成二维行数组，
 * 输出格式与 csvUtils.csvTextToRows 一致：
 *   string[][] → 每行是列数组
 *
 * 这样所有 CSV 解析器（微信/支付宝/银行/通用）都能直接处理 Excel，
 * 不需要额外适配。
 *
 * 只依赖 xlsx 库，不依赖其他解析器。
 */

const XLSX = require('xlsx')

/**
 * 把 Excel 文件 Buffer 转成二维行数组
 * @param {Buffer} buffer .xlsx/.xls 文件二进制内容
 * @returns {string[][]} 二维行数组（与 CSV 拆行后格式一致）
 */
function toArray(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  // 取第一个 sheet
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]

  // header:1 → 返回二维数组，每行是列数组
  // raw:false → 所有值转成字符串（避免数字精度问题）
  // defval:'' → 空单元格给默认空字符串
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  // 转成 string[][] 并 trim
  return rows.map(row =>
    (Array.isArray(row) ? row : []).map(cell => String(cell || '').trim())
  )
}

/**
 * 判断文件是否是 Excel（按扩展名）
 */
function isExcelFile(fileName) {
  if (!fileName) return false
  return /\.(xlsx|xls)$/i.test(fileName)
}

/**
 * 按文件内容判断是否是 Excel（检测二进制头/magic bytes）
 *
 * 有些银行（如建行）导出的文件后缀是 .csv，
 * 但实际是 Excel 二进制格式，需要按内容检测：
 *   - OLE2 (.xls): 前4字节 D0 CF 11 E0
 *   - ZIP  (.xlsx): 前4字节 50 4B 03 04
 *
 * @param {Buffer} buffer 文件前几字节
 * @returns {boolean}
 */
function isExcelByContent(buffer) {
  if (!buffer || buffer.length < 4) return false
  // OLE2 (xls): D0 CF 11 E0
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) return true
  // ZIP (xlsx): 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return true
  return false
}

module.exports = { toArray, isExcelFile, isExcelByContent }
