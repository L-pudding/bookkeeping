// pages/transactions/transactions.js
const { getTransactions, getAccounts } = require('../../utils/api.js')
const { formatMoney, formatDateTime } = require('../../utils/format.js')

const SOURCE_LABELS = {
  manual: '',
  wechat_bill: '微信账单',
  alipay_bill: '支付宝账单',
  bank_bill: '银行流水',
}

Page({
  data: {
    transactions: [],
    accounts: [],
    accountNames: ['全部账户'],
    filterAccountIdx: 0,
    filterDate: '',
    filterDateLabel: '全部时间',
    totalExpense: '0.00',
    totalIncome: '0.00',
    totalBalance: '0.00',
  },

  onShow() {
    this.loadAccounts()
    this.loadTransactions()
  },

  async loadAccounts() {
    try {
      const res = await getAccounts()
      if (res.success) {
        const names = ['全部账户', ...res.data.map(a => a.icon + ' ' + a.name)]
        this.setData({ accounts: res.data, accountNames: names })
      }
    } catch (e) {
      console.error('加载账户失败:', e)
    }
  },

  async loadTransactions() {
    wx.showLoading({ title: '加载中...' })
    try {
      const params = {}

      // 账户筛选
      if (this.data.filterAccountIdx > 0) {
        params.accountId = this.data.accounts[this.data.filterAccountIdx - 1]._id
      }

      // 日期筛选
      if (this.data.filterDate) {
        const [year, month] = this.data.filterDate.split('-')
        const start = new Date(year, month - 1, 1).getTime()
        const end = new Date(year, month, 1).getTime() - 1
        params.startDate = start
        params.endDate = end
      }

      const res = await getTransactions(params)
      wx.hideLoading()

      if (res.success) {
        const accounts = this.data.accounts
        const txns = res.data.map(t => {
          const account = accounts.find(a => a._id === t.accountId)
          return {
            ...t,
            amountStr: formatMoney(t.amount),
            timeStr: formatDateTime(t.timestamp),
            accountName: account ? account.name : '',
            sourceLabel: SOURCE_LABELS[t.source] || '',
          }
        })

        let expense = 0, income = 0
        txns.forEach(t => {
          if (t.type === 'expense') expense += Number(t.amount)
          else if (t.type === 'income') income += Number(t.amount)
        })

        this.setData({
          transactions: txns,
          totalExpense: formatMoney(expense),
          totalIncome: formatMoney(income),
          totalBalance: formatMoney(income - expense),
        })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('加载流水失败:', e)
    }
  },

  onAccountChange(e) {
    this.setData({ filterAccountIdx: e.detail.value })
    this.loadTransactions()
  },

  onDateChange(e) {
    const val = e.detail.value
    this.setData({
      filterDate: val,
      filterDateLabel: val || '全部时间',
    })
    this.loadTransactions()
  },
})
