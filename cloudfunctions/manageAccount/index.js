/**
 * manageAccount 云函数
 * 管理账户：新增、编辑、删除
 *
 * 入参：
 *   action: 'add' | 'update' | 'delete'
 *   name: 账户名称
 *   type: 'cash' | 'savings' | 'credit' | 'ewallet'
 *   initialBalance: 初始余额
 *   currentBalance: 当前实际余额（用户手动设定，用于对账）
 *   icon: 图标（emoji）
 *   id: 账户 ID（update/delete 时需要）
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const {
    action = 'add',
    id,
    name,
    type = 'cash',
    initialBalance = 0,
    currentBalance = 0,
    icon = '💰',
  } = event

  // 新增
  if (action === 'add') {
    if (!name) return { success: false, error: '账户名称不能为空' }

    // 查询当前最大 sortOrder
    const existing = await db.collection('accounts')
      .where({ _openid: OPENID })
      .orderBy('sortOrder', 'desc')
      .limit(1)
      .get()
    const nextSort = existing.data.length > 0 ? existing.data[0].sortOrder + 1 : 1

    const account = {
      _openid: OPENID,
      name,
      type,
      initialBalance: Number(initialBalance),
      currentBalance: Number(currentBalance),  // 用户设定的实际余额
      icon,
      sortOrder: nextSort,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    }

    const res = await db.collection('accounts').add({ data: account })
    return { success: true, data: { ...account, _id: res._id } }
  }

  // 编辑
  if (action === 'update') {
    if (!id) return { success: false, error: '缺少账户 ID' }

    const update = {
      updatedAt: db.serverDate(),
    }
    if (name !== undefined) update.name = name
    if (type !== undefined) update.type = type
    if (initialBalance !== undefined) update.initialBalance = Number(initialBalance)
    if (currentBalance !== undefined) update.currentBalance = Number(currentBalance)
    if (icon !== undefined) update.icon = icon

    await db.collection('accounts').doc(id).update({ data: update })
    return { success: true }
  }

  // 删除
  if (action === 'delete') {
    if (!id) return { success: false, error: '缺少账户 ID' }

    // 检查该账户是否有关联交易
    const txns = await db.collection('transactions')
      .where({ _openid: OPENID, accountId: id })
      .limit(1)
      .get()
    if (txns.data.length > 0) {
      return { success: false, error: '该账户下还有交易记录，无法删除。请先处理相关交易。' }
    }

    await db.collection('accounts').doc(id).remove()
    return { success: true }
  }

  return { success: false, error: '未知操作: ' + action }
}
