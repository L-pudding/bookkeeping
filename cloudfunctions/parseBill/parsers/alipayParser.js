/**
 * alipayParser.js - 支付宝账单解析器
 *
 * 支付宝导出的 CSV 格式（列较多，取关键字段）：
 *   交易号,商家订单号,交易创建时间,付款时间,...,金额(元),收/支,...
 *
 * 只依赖 csvUtils。
 */

const { parseDate, parseAmount } = require('./csvUtils')

/**
 * 自动检测关键列索引（按表头关键词）
 */
function detectColumns(header) {
  const colMap = { timeCol: -1, amountCol: -1, directionCol: -1, merchantCol: -1 }
  for (let i = 0; i < header.length; i++) {
    const h = header[i].trim()
    if (colMap.timeCol < 0 && /交易创建时间|付款时间|时间/.test(h)) colMap.timeCol = i
    if (colMap.amountCol < 0 && /金额/.test(h)) colMap.amountCol = i
    if (colMap.directionCol < 0 && /收\/?支/.test(h)) colMap.directionCol = i
    if (colMap.merchantCol < 0 && /交易对方|对方|商家|商户/.test(h)) colMap.merchantCol = i
  }
  return colMap
}

/**
 * @param {string[][]} rows 二维行数组
 * @returns {object[]} record 数组
 */
function parse(rows) {
  if (rows.length < 2) return []

  const header = rows[0]
  const colMap = detectColumns(header)
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols || cols.length < 3) continue

    const amountStr = colMap.amountCol >= 0 ? cols[colMap.amountCol] : ''
    const amount = parseAmount(amountStr)
    if (!amount) continue

    const direction = colMap.directionCol >= 0 ? cols[colMap.directionCol] : ''
    const type = /收入/.test(direction) ? 'income' : 'expense'

    const timeStr = colMap.timeCol >= 0 ? cols[colMap.timeCol] : ''
    const timestamp = parseDate(timeStr)
    if (!timestamp) continue

    records.push({
      amount: Math.abs(amount),
      type,
      merchant: colMap.merchantCol >= 0 ? cols[colMap.merchantCol] : '',
      timestamp,
      note: '',
    })
  }

  return records
}

module.exports = { parse }
