// pages/home/home.js
const { addTransaction, getAccounts, initData } = require('../../utils/api.js')
const { formatMoney, getCurrentMonthRange } = require('../../utils/format.js')

Page({
  data: {
    type: 'expense',
    amount: '',
    amountFocus: false,
    merchant: '',
    note: '',
    accounts: [],
    categories: [],
    selectedAccount: null,
    selectedCategory: null,
    accountPickerVisible: false,
    categoryPickerVisible: false,
    monthExpense: '0.00',
    monthIncome: '0.00',
    monthBalance: '0.00',
  },

  onShow() {
    this.loadAccounts()
    this.loadCategories()
    this.loadMonthSummary()
  },

  // 加载账户
  async loadAccounts() {
    try {
      const res = await getAccounts()
      if (res.success) {
        this.setData({ accounts: res.data })
        // 如果还没选中账户，默认选第一个
        if (!this.data.selectedAccount && res.data.length > 0) {
          this.setData({ selectedAccount: res.data[0] })
        }
      }
    } catch (e) {
      // 如果账户还没初始化，先初始化
      if (this.data.accounts.length === 0) {
        await this.tryInit()
      }
    }
  },

  async tryInit() {
    try {
      await initData()
      const res = await getAccounts()
      if (res.success) {
        this.setData({ accounts: res.data, selectedAccount: res.data[0] })
      }
    } catch (e) {
      console.error('初始化失败:', e)
    }
  },

  // 加载分类（从云数据库直接读）
  async loadCategories() {
    const db = wx.cloud.database()
    try {
      const res = await db.collection('categories')
        .where({ type: this.data.type })
        .orderBy('sortOrder', 'asc')
        .get()
      this.setData({ categories: res.data })
    } catch (e) {
      console.error('加载分类失败:', e)
    }
  },

  // 加载本月收支概览
  async loadMonthSummary() {
    try {
      const { start, end } = getCurrentMonthRange()
      const db = wx.cloud.database()
      const _ = db.command
      const res = await db.collection('transactions')
        .where({ timestamp: _.gte(start).and(_.lte(end)) })
        .get()

      let expense = 0, income = 0
      res.data.forEach(t => {
        if (t.type === 'expense') expense += Number(t.amount)
        else if (t.type === 'income') income += Number(t.amount)
      })

      this.setData({
        monthExpense: formatMoney(expense),
        monthIncome: formatMoney(income),
        monthBalance: formatMoney(income - expense),
      })
    } catch (e) {
      console.error('加载概览失败:', e)
    }
  },

  // 切换收支类型
  switchType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ type, selectedCategory: null })
    this.loadCategories()
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  onMerchantInput(e) {
    this.setData({ merchant: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  showAccountPicker() {
    this.setData({ accountPickerVisible: true })
  },

  hideAccountPicker() {
    this.setData({ accountPickerVisible: false })
  },

  selectAccount(e) {
    const id = e.currentTarget.dataset.id
    const account = this.data.accounts.find(a => a._id === id)
    this.setData({ selectedAccount: account, accountPickerVisible: false })
  },

  showCategoryPicker() {
    this.setData({ categoryPickerVisible: true })
  },

  hideCategoryPicker() {
    this.setData({ categoryPickerVisible: false })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(c => c._id === id)
    this.setData({ selectedCategory: category, categoryPickerVisible: false })
  },

  // 保存交易
  async saveTransaction() {
    const { amount, type, selectedAccount, selectedCategory, merchant, note } = this.data

    if (!amount || !selectedAccount) {
      wx.showToast({ title: '请填写金额和账户', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const res = await addTransaction({
        amount: Number(amount),
        type,
        accountId: selectedAccount._id,
        category: selectedCategory ? selectedCategory.name : '',
        merchant,
        note,
        timestamp: Date.now(),
        source: 'manual',
      })

      wx.hideLoading()

      if (res.success) {
        if (res.duplicate) {
          wx.showToast({ title: '该笔已存在，未重复记录', icon: 'none', duration: 2500 })
        } else {
          wx.showToast({ title: '已记账', icon: 'success' })
        }
        // 重置表单
        this.setData({
          amount: '',
          merchant: '',
          note: '',
          selectedCategory: null,
        })
        // 刷新概览
        this.loadMonthSummary()
      } else {
        wx.showToast({ title: res.error || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error(e)
    }
  },
})
