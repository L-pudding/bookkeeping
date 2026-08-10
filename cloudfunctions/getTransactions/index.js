/**
 * getTransactions 云函数
 * 查询交易列表，支持按账户、日期、分类筛选
 *
 * 入参：
 *   accountId: 可选，按账户筛选
 *   startDate: 可选，起始时间戳（毫秒）
 *   endDate: 可选，结束时间戳（毫秒）
 *   category: 可选，按分类筛选
 *   limit: 可选，默认 100
 *   skip: 可选，分页偏移
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const {
    accountId,
    startDate,
    endDate,
    category,
    limit = 100,
    skip = 0,
  } = event

  const query = { _openid: OPENID }

  if (accountId) query.accountId = accountId
  if (category) query.category = category
  if (startDate && endDate) {
    query.timestamp = _.gte(Number(startDate)).and(_.lte(Number(endDate)))
  } else if (startDate) {
    query.timestamp = _.gte(Number(startDate))
  } else if (endDate) {
    query.timestamp = _.lte(Number(endDate))
  }

  const res = await db.collection('transactions')
    .where(query)
    .orderBy('timestamp', 'desc')
    .skip(skip)
    .limit(limit)
    .get()

  return {
    success: true,
    data: res.data,
    total: res.data.length,
  }
}
