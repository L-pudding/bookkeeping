/**
 * bankParser.js - 银行流水智能解析器
 *
 * 自动识别列头，适配招行/工行/建行/农行/中行等主流格式。
 *
 * 适配的列名变化：
 *   - 日期：交易日期/记账日期/日期/时间
 *   - 金额：金额/发生额/交易额（单列，正负号区分收支）
 *   - 收入/支出分两列：收入,支出 / 贷方,借方 / 存入,支出
 *   - 商户：对方户名/商户/交易对方（优先） > 描述/摘要（兜底）
 *   - 日期格式：2026-08-10、2026/08/10、20260810 等
 *   - 减号：支持全角减号 − (U+2212)、em dash —
 *
 * 只依赖 csvUtils。
 */

const { parseDate, parseAmount } = require('./csvUtils')

/**
 * 银行列头识别：返回列映射
 * @param {string[]} headerCols 表头行
 * @returns {object} 列映射
 */
function detectColumns(headerCols) {
  const map = {
    dateCol: -1,
    amountCol: -1,      // 单列金额模式
    incomeCol: -1,      // 收入单列模式
    expenseCol: -1,     // 支出单列模式
    merchantCol: -1,
    noteCol: -1,
    amountMode: 'sign', // 'sign'=正负号 | 'income_expense'=收支分两列
  }

  // 先找高优先级商户列（户名/商户/交易对方）
  // 注意：建行的列叫"对方账号与户名"，同时含"账号"和"户名"，
  // 不能简单排除"账号"，要看是否含"户名"
  for (let i = 0; i < headerCols.length; i++) {
    const h = headerCols[i].trim()
    // 匹配含"户名"的列（即使也含"账号"），或"商户"/"交易对方"
    if (/户名|商户|交易对方|对方名称/.test(h)) {
      map.merchantCol = i
      break
    }
  }

  for (let i = 0; i < headerCols.length; i++) {
    const h = headerCols[i].trim()

    // 日期列
    if (map.dateCol < 0 && /日期|时间|记账/.test(h)) {
      map.dateCol = i
    }

    // 收入列（单独一列）
    if (/^收入$|收入金额|贷方|存入/.test(h)) {
      map.incomeCol = i
      map.amountMode = 'income_expense'
    }

    // 支出列（单独一列）
    if (/^支出$|支出金额|借方|支出/.test(h)) {
      map.expenseCol = i
      map.amountMode = 'income_expense'
    }

    // 统一金额列（正负号区分收支）
    if (map.amountCol < 0 && /金额|发生额|交易额|本期金额/.test(h) && !/收入|支出|贷方|借方/.test(h)) {
      map.amountCol = i
    }

    // 低优先级商户列（描述/摘要，只在没找到高优先级时用）
    if (map.merchantCol < 0 && /描述|摘要/.test(h)) {
      map.merchantCol = i
    }

    // 备注
    if (map.noteCol < 0 && /备注|附言|用途/.test(h)) {
      map.noteCol = i
    }
  }

  return map
}

/**
 * 按列映射解析银行数据行
 */
function parseRow(cols, map) {
  // 日期
  const dateStr = map.dateCol >= 0 ? cols[map.dateCol] : ''
  const timestamp = parseDate(dateStr)
  if (!timestamp) return null

  // 金额
  let amount = 0
  let type = 'expense'

  if (map.amountMode === 'income_expense') {
    // 收入/支出分两列
    const income = parseAmount(map.incomeCol >= 0 ? cols[map.incomeCol] : '')
    const expense = parseAmount(map.expenseCol >= 0 ? cols[map.expenseCol] : '')

    if (income > 0) {
      amount = income
      type = 'income'
    } else if (expense > 0) {
      amount = expense
      type = 'expense'
    } else {
      return null
    }
  } else {
    // 单列金额，靠正负号区分
    const raw = parseAmount(map.amountCol >= 0 ? cols[map.amountCol] : '')
    if (!raw) return null

    amount = Math.abs(raw)
    type = raw > 0 ? 'income' : 'expense'
  }

  // 商户：建行格式 "账号/户名" → 取 "/" 后面的名称
  let merchant = (map.merchantCol >= 0 ? cols[map.merchantCol] : '').trim()
  if (merchant.includes('/')) {
    const parts = merchant.split('/')
    merchant = parts[parts.length - 1].trim()
  }
  const note = (map.noteCol >= 0 && map.noteCol !== map.merchantCol ? cols[map.noteCol] : '').trim()

  return { amount, type, merchant, timestamp, note }
}

/**
 * @param {string[][]} rows 二维行数组
 * @returns {object[]} record 数组
 */
function parse(rows) {
  // 找表头行（"日期"和"金额"关键词出现在不同列里才算表头）
  // 建行流水第2行有"当前时间段收支金额合计"，"时间"和"金额"在同一单元格，
  // 不能误判为表头
  let headerRow = null
  let dataStart = 0

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols = rows[i]
    let dateColIdx = -1, amountColIdx = -1
    for (let j = 0; j < cols.length; j++) {
      const c = cols[j] || ''
      if (dateColIdx < 0 && /日期|时间|记账/.test(c)) dateColIdx = j
      if (amountColIdx < 0 && /金额|发生额|支出|收入|交易额/.test(c)) amountColIdx = j
    }
    // 日期和金额必须在不同列（排除汇总行）
    if (dateColIdx >= 0 && amountColIdx >= 0 && dateColIdx !== amountColIdx) {
      headerRow = cols
      dataStart = i + 1
      break
    }
  }

  // 没找到表头，按第0行跳过处理
  if (!headerRow) {
    dataStart = 1
    headerRow = []
  }

  const colMap = detectColumns(headerRow)
  const records = []

  for (let i = dataStart; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols) continue
    const record = parseRow(cols, colMap)
    if (record && record.amount) {
      records.push(record)
    }
  }

  return records
}

module.exports = { parse, detectColumns, parseRow }
