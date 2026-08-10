/**
 * wechatParser.js - 微信支付账单解析器
 *
 * 微信导出的 CSV 格式：
 *   交易时间,交易类型,交易对方,商品,金额(元),收/支,支付状态,交易单号
 *
 * 只依赖 csvUtils，不依赖其他解析器。
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
  if (rows.length > 0 && rows[0].some(c => /交易时间|金额|交易类型/.test(c))) {
    start = 1
  }

  for (let i = start; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols || cols.length < 5) continue

    // 金额在第5列（index 4），收/支在第6列（index 5）
    const amountStr = cols[4]
    const direction = cols[5] || ''

    const amount = parseAmount(amountStr)
    if (!amount) continue

    const type = /收入/.test(direction) ? 'income' : 'expense'

    const timestamp = parseDate(cols[0])
    if (!timestamp) continue

    records.push({
      amount: Math.abs(amount),
      type,
      merchant: cols[2] || cols[3] || '',
      timestamp,
      note: cols[3] || '',
    })
  }

  return records
}

module.exports = { parse }
