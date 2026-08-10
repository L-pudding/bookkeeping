/**
 * initData 云函数
 * 初始化默认分类和默认账户（首次使用时调用）
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认支出分类
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: '🍔', sortOrder: 1 },
  { name: '交通', icon: '🚇', sortOrder: 2 },
  { name: '购物', icon: '🛒', sortOrder: 3 },
  { name: '生活', icon: '🏠', sortOrder: 4 },
  { name: '娱乐', icon: '🎮', sortOrder: 5 },
  { name: '医疗', icon: '💊', sortOrder: 6 },
  { name: '教育', icon: '📚', sortOrder: 7 },
  { name: '人情', icon: '🎁', sortOrder: 8 },
  { name: '其他', icon: '📝', sortOrder: 99 },
]

// 默认收入分类
const DEFAULT_INCOME_CATEGORIES = [
  { name: '工资', icon: '💰', sortOrder: 1 },
  { name: '兼职', icon: '💼', sortOrder: 2 },
  { name: '理财', icon: '📈', sortOrder: 3 },
  { name: '红包', icon: '🧧', sortOrder: 4 },
  { name: '其他', icon: '📝', sortOrder: 99 },
]

// 默认账户
const DEFAULT_ACCOUNTS = [
  { name: '微信支付', type: 'ewallet', icon: '💚', initialBalance: 0 },
  { name: '支付宝', type: 'ewallet', icon: '💙', initialBalance: 0 },
  { name: '现金', type: 'cash', icon: '💵', initialBalance: 0 },
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const results = { categories: 0, accounts: 0 }

  // 检查是否已初始化
  const existingCats = await db.collection('categories')
    .where({ _openid: OPENID })
    .limit(1)
    .get()
  const existingAccounts = await db.collection('accounts')
    .where({ _openid: OPENID })
    .limit(1)
    .get()

  // 初始化分类
  if (existingCats.data.length === 0) {
    const allCats = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, type: 'expense', _openid: OPENID })),
      ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, type: 'income', _openid: OPENID })),
    ]
    for (const cat of allCats) {
      await db.collection('categories').add({ data: cat })
      results.categories++
    }
  }

  // 初始化账户
  if (existingAccounts.data.length === 0) {
    for (let i = 0; i < DEFAULT_ACCOUNTS.length; i++) {
      const acc = DEFAULT_ACCOUNTS[i]
      await db.collection('accounts').add({
        data: {
          _openid: OPENID,
          name: acc.name,
          type: acc.type,
          icon: acc.icon,
          initialBalance: acc.initialBalance,
          currentBalance: acc.initialBalance,
          sortOrder: i + 1,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        }
      })
      results.accounts++
    }
  }

  return {
    success: true,
    message: `初始化完成：${results.categories} 个分类，${results.accounts} 个账户`,
    data: results,
  }
}
