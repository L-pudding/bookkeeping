/**
 * fingerprint.js - 交易指纹生成与去重工具
 *
 * 指纹 = hash(归一化金额 + 分钟级时间 + 归一化商户名)
 * 用于防止同一笔交易被重复记录（手动记了又从账单导入）
 */

/**
 * 归一化金额：去掉逗号，保留2位小数字符串
 */
function normalizeAmount(amount) {
  if (typeof amount === 'string') {
    amount = amount.replace(/,/g, '')
  }
  return Number(amount).toFixed(2)
}

/**
 * 归一化时间戳：取分钟级（去掉秒），容忍秒级偏差
 */
function normalizeTimestamp(timestamp) {
  // 确保是毫秒级时间戳
  if (timestamp < 1e12) timestamp = timestamp * 1000
  return Math.floor(timestamp / 60000) * 60000
}

/**
 * 归一化商户名：去空格、转小写、去特殊字符
 */
function normalizeMerchant(merchant) {
  if (!merchant) return ''
  return String(merchant)
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

/**
 * 生成交易指纹
 * @param {Object} param
 * @param {number|string} param.amount 金额
 * @param {number|string|Date} param.timestamp 时间
 * @param {string} param.merchant 商户名
 * @returns {string} 指纹字符串 fp_xxx
 */
function generateFingerprint({ amount, timestamp, merchant }) {
  const normAmount = normalizeAmount(amount)
  const normTime = normalizeTimestamp(
    typeof timestamp === 'object' ? timestamp.getTime() : Number(timestamp)
  )
  const normMerchant = normalizeMerchant(merchant)
  const raw = `${normAmount}|${normTime}|${normMerchant}`
  return simpleHash(raw)
}

/**
 * 简单 hash 函数（云函数端可用 crypto，前端用这个轻量版）
 */
function simpleHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) + hash) + char  // hash * 33 + char
    hash = hash & hash  // 转为32位整数
  }
  return 'fp_' + Math.abs(hash).toString(36)
}

module.exports = {
  generateFingerprint,
  normalizeAmount,
  normalizeTimestamp,
  normalizeMerchant,
}
