/**
 * csvUtils.js - 共享的 CSV/行 解析工具
 *
 * 所有解析器（微信/支付宝/银行/通用）共用这套工具，
 * 避免日期解析、金额清洗等逻辑重复实现。
 *
 * 接口约定：
 *   - 入参 rows：二维数组，每个元素是一行的列数组
 *   - 返回值：record 数组 [{ amount, type, merchant, timestamp, note }]
 */

/**
 * 分割 CSV 单行（处理引号包裹的字段）
 * @param {string} line 一行 CSV 文本
 * @returns {string[]} 列数组
 */
function splitCSVLine(line) {
  const cols = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuote = !inQuote
    } else if (char === ',' && !inQuote) {
      cols.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cols.push(current.trim())
  return cols
}

/**
 * 把 CSV 文本拆成二维数组
 * @param {string} content CSV 文本
 * @returns {string[][]} 行数组，每行是列数组
 */
function csvTextToRows(content) {
  return content
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(splitCSVLine)
}

/**
 * 日期解析（支持多种格式）
 * 适配：2026-08-10、2026/08/10、2026.08.10、20260810、2026-08-10 14:30、20260810143000
 * @param {string} str 日期字符串
 * @returns {number|null} 毫秒级时间戳
 */
function parseDate(str) {
  if (!str) return null
  str = String(str).trim()

  // 2026-08-10 14:30:00 / 2026/08/10 14:30:00 / 2026.08.10 14:30
  let m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\s T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (m) return new Date(m[1], m[2] - 1, m[3], m[4], m[5]).getTime()

  // 2026-08-10 / 2026/08/10 / 2026.08.10
  m = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return new Date(m[1], m[2] - 1, m[3]).getTime()

  // 20260810（建行/工行紧凑日期）
  m = str.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return new Date(m[1], m[2] - 1, m[3]).getTime()

  // 20260810143000（紧凑日期时间）
  m = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (m) return new Date(m[1], m[2] - 1, m[3], m[4], m[5]).getTime()

  return null
}

/**
 * 金额清洗：处理全角减号、千分位逗号、特殊字符
 * @param {string} str 金额字符串
 * @returns {string} 清洗后的金额字符串
 */
function cleanAmount(str) {
  if (!str) return '0'
  return String(str)
    .replace(/−/g, '-')      // 全角减号 U+2212 → ASCII
    .replace(/—/g, '-')      // em dash → ASCII
    .replace(/[,，]/g, '')   // 去千分位逗号（全角+半角）
    .replace(/[^\d.-]/g, '')
}

/**
 * 把字符串金额解析为数字
 * @param {string} str
 * @returns {number}
 */
function parseAmount(str) {
  return parseFloat(cleanAmount(str)) || 0
}

module.exports = {
  splitCSVLine,
  csvTextToRows,
  parseDate,
  cleanAmount,
  parseAmount,
}
