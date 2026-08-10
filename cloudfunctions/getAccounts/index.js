/**
 * getAccounts 云函数
 * 获取当前用户的所有账户列表
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('accounts')
    .where({ _openid: OPENID })
    .orderBy('sortOrder', 'asc')
    .get()

  return {
    success: true,
    data: res.data,
  }
}
