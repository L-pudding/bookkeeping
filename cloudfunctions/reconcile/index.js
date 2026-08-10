/**
 * reconcile 云函数
 * 对账：计算每个账户的"应有余额"vs"实际余额"
 *
 * 应有余额 = 初始余额 + Σ(收入) - Σ(支出)
 * 实际余额 = 用户手动设定的 currentBalance
 * 差额 = 实际余额 - 应有余额
 *
 * 差额 ≠ 0 → 有漏记或错记
 *
 * 入参：
 *   accountId: 可选，只对单个账户对账
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { accountId } = event

  // 获取账户
  const accountQuery = { _openid: OPENID }
  if (accountId) accountQuery._id = accountId

  const accountsRes = await db.collection('accounts')
    .where(accountQuery)
    .orderBy('sortOrder', 'asc')
    .get()

  const result = []

  for (const account of accountsRes.data) {
    // 查该账户所有交易
    const txnsRes = await db.collection('transactions')
      .where({ _openid: OPENID, accountId: account._id })
      .get()

    const txns = txnsRes.data
    let totalIncome = 0
    let totalExpense = 0

    txns.forEach(t => {
      if (t.type === 'income') {
        totalIncome += Number(t.amount)
      } else if (t.type === 'expense') {
        totalExpense += Number(t.amount)
      }
    })

    const expectedBalance = Number(account.initialBalance) + totalIncome - totalExpense
    const actualBalance = Number(account.currentBalance)
    const diff = actualBalance - expectedBalance

    result.push({
      _id: account._id,
      name: account.name,
      icon: account.icon,
      type: account.type,
      initialBalance: Number(account.initialBalance),
      totalIncome,
      totalExpense,
      expectedBalance: Math.round(expectedBalance * 100) / 100,
      actualBalance: actualBalance,
      diff: Math.round(diff * 100) / 100,
      isMatch: Math.abs(diff) < 0.01,  // 差额小于1分钱算匹配
      txnCount: txns.length,
    })
  }

  return {
    success: true,
    data: result,
  }
}
