/**
 * format.js - 格式化工具
 */

/**
 * 格式化金额：1234.5 -> "1,234.50"
 */
function formatMoney(num) {
  if (num === null || num === undefined || num === '') return '0.00'
  const n = Number(num)
  if (isNaN(n)) return '0.00'
  const fixed = Math.abs(n).toFixed(2)
  const parts = fixed.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (n < 0 ? '-' : '') + parts.join('.')
}

/**
 * 格式化日期时间戳 -> "2026-08-10 14:30"
 */
function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 格式化日期 -> "2026-08-10"
 */
function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 获取本月起止时间戳
 */
function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1
  return { start, end }
}

module.exports = {
  formatMoney,
  formatDateTime,
  formatDate,
  getCurrentMonthRange,
}
