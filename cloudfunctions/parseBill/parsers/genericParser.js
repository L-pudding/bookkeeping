/**
 * genericParser.js - 通用 CSV 解析器
 *
 * 期望格式：金额,时间,商户,分类
 * 金额正数=收入，负数=支出
 *
 * 只依赖 csvUtils。
 */

const { parseDate, parseAmount } = require('./csvUtils')

/**
 * @param {string[][]} rows 二维行数组
 * @returns {object[]} record 数组
 */
function parse(rows) {
  const records = []
  let start = 0

  // 跳过表头
  if (rows.length > 0 && rows[0].some(c => /金额|时间|日期/.test(c))) {
    start = 1
  }

  for (let i = start; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols || cols.length < 2) continue

    const amount = parseAmount(cols[0])
    if (!amount) continue

    const timestamp = parseDate(cols[1])
    if (!timestamp) continue

    records.push({
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      merchant: cols[2] || '',
      timestamp,
      note: '',
    })
  }

  return records
}

module.exports = { parse }
