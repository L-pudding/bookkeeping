/**
 * addTransaction 云函数
 * 添加一笔交易，含指纹去重逻辑
 *
 * 入参：
 *   amount: 金额（正数）
 *   type: 'expense' | 'income' | 'transfer'
 *   accountId: 账户 ID
 *   category: 分类名称
 *   merchant: 商户
 *   note: 备注
 *   timestamp: 交易时间戳（毫秒），不传则用当前时间
 *   source: 'manual' | 'wechat_bill' | 'alipay_bill' | 'bank_bill'
 *
 * 返回：
 *   { success: true, transaction: {...} }  或
 *   { success: true, duplicate: true, existingId: 'xxx' }  重复时
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 指纹生成（与前端 fingerprint.js 一致）
function normalizeAmount(amount) {
  if (typeof amount === 'string') amount = amount.replace(/,/g, '')
  return Number(amount).toFixed(2)
}
function normalizeTimestamp(ts) {
  if (ts < 1e12) ts = ts * 1000
  return Math.floor(ts / 60000) * 60000
}
function normalizeMerchant(m) {
  if (!m) return ''
  return String(m).replace(/\s+/g, '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
}
function generateFingerprint({ amount, timestamp, merchant }) {
  const raw = `${normalizeAmount(amount)}|${normalizeTimestamp(timestamp)}|${normalizeMerchant(merchant)}`
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i)
    hash = hash & hash
  }
  return 'fp_' + Math.abs(hash).toString(36)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const {
    amount,
    type = 'expense',
    accountId,
    category = '',
    merchant = '',
    note = '',
    timestamp = Date.now(),
    source = 'manual',
  } = event

  // 参数校验
  if (!amount || !accountId) {
    return { success: false, error: '缺少金额或账户参数' }
  }

  const finalTimestamp = typeof timestamp === 'object' ? timestamp.getTime() : Number(timestamp)

  // 生成指纹
  const fingerprint = generateFingerprint({ amount, timestamp: finalTimestamp, merchant })

  // 去重检查：同一用户下，同指纹的交易已存在则跳过
  const existing = await db.collection('transactions').where({
    _openid: OPENID,
    fingerprint: fingerprint,
  }).limit(1).get()

  if (existing.data.length > 0) {
    return {
      success: true,
      duplicate: true,
      existingId: existing.data[0]._id,
      message: '该笔交易已存在（指纹匹配），未重复记录',
    }
  }

  // 插入新交易
  const transaction = {
    _openid: OPENID,
    accountId,
    amount: Number(amount),
    type,
    category,
    merchant,
    note,
    timestamp: finalTimestamp,
    source,
    fingerprint,
    createdAt: db.serverDate(),
  }

  const res = await db.collection('transactions').add({ data: transaction })

  return {
    success: true,
    duplicate: false,
    transaction: { ...transaction, _id: res._id },
  }
}
