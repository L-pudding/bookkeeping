// pages/reconcile/reconcile.js
const { reconcile, manageAccount } = require('../../utils/api.js')
const { formatMoney } = require('../../utils/format.js')

Page({
  data: {
    accounts: [],
    summary: { total: 0, matched: 0, mismatched: 0 },
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    wx.showLoading({ title: '对账中...' })
    try {
      const res = await reconcile()
      wx.hideLoading()

      if (res.success) {
        const accounts = res.data.map(a => ({
          ...a,
          initialBalanceStr: formatMoney(a.initialBalance),
          totalIncomeStr: formatMoney(a.totalIncome),
          totalExpenseStr: formatMoney(a.totalExpense),
          expectedBalanceStr: formatMoney(a.expectedBalance),
          actualBalanceStr: formatMoney(a.actualBalance),
          diffStr: formatMoney(a.diff),
        }))

        const matched = accounts.filter(a => a.isMatch).length
        const mismatched = accounts.length - matched

        this.setData({
          accounts,
          summary: { total: accounts.length, matched, mismatched },
        })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('对账失败:', e)
      wx.showToast({ title: '对账失败', icon: 'none' })
    }
  },

  // 以应有余额更新实际余额
  async updateActual(e) {
    const id = e.currentTarget.dataset.id
    const expected = e.currentTarget.dataset.expected

    const res = await wx.showModal({
      title: '更新实际余额',
      content: `将实际余额设为 ¥${formatMoney(expected)}？\n\n建议你先检查该账户的流水，确认没有漏记再更新。如果确认流水完整，可以直接更新。`,
    })
    if (!res.confirm) return

    wx.showLoading({ title: '更新中...' })
    try {
      const res = await manageAccount({
        action: 'update',
        id,
        currentBalance: expected,
      })
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '已更新', icon: 'success' })
        this.refresh()
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },
})
