// pages/accounts/accounts.js
const { getAccounts, manageAccount } = require('../../utils/api.js')
const { formatMoney } = require('../../utils/format.js')

Page({
  data: {
    accounts: [],
    typeLabels: { cash: '现金', savings: '储蓄卡', credit: '信用卡', ewallet: '电子钱包' },
    typeOptions: [
      { label: '现金', value: 'cash' },
      { label: '储蓄卡', value: 'savings' },
      { label: '信用卡', value: 'credit' },
      { label: '电子钱包', value: 'ewallet' },
    ],
    iconOptions: ['💰', '💚', '💙', '💵', '🏦', '💳', '🪙', '📈'],
    editVisible: false,
    editingId: null,
    form: {
      name: '',
      typeIdx: 0,
      icon: '💰',
      initialBalance: '',
      currentBalance: '',
    },
  },

  onShow() {
    this.loadAccounts()
  },

  async loadAccounts() {
    try {
      const res = await getAccounts()
      if (res.success) {
        const accounts = res.data.map(a => ({
          ...a,
          balanceStr: formatMoney(a.currentBalance),
        }))
        this.setData({ accounts })
      }
    } catch (e) {
      console.error('加载账户失败:', e)
    }
  },

  addAccount() {
    this.setData({
      editVisible: true,
      editingId: null,
      form: {
        name: '',
        typeIdx: 0,
        icon: '💰',
        initialBalance: '',
        currentBalance: '',
      },
    })
  },

  editAccount(e) {
    const id = e.currentTarget.dataset.id
    const account = this.data.accounts.find(a => a._id === id)
    if (!account) return

    const typeIdx = this.data.typeOptions.findIndex(t => t.value === account.type)

    this.setData({
      editVisible: true,
      editingId: id,
      form: {
        name: account.name,
        typeIdx: typeIdx >= 0 ? typeIdx : 0,
        icon: account.icon || '💰',
        initialBalance: String(account.initialBalance || ''),
        currentBalance: String(account.currentBalance || ''),
      },
    })
  },

  hideEdit() {
    this.setData({ editVisible: false })
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ 'form.typeIdx': e.detail.value })
  },

  selectIcon(e) {
    this.setData({ 'form.icon': e.currentTarget.dataset.icon })
  },

  async saveAccount() {
    const { form, editingId } = this.data
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入账户名称', icon: 'none' })
      return
    }

    const data = {
      action: editingId ? 'update' : 'add',
      name: form.name.trim(),
      type: this.data.typeOptions[form.typeIdx].value,
      icon: form.icon,
      initialBalance: Number(form.initialBalance) || 0,
      currentBalance: Number(form.currentBalance) || 0,
    }
    if (editingId) data.id = editingId

    wx.showLoading({ title: '保存中...' })
    try {
      const res = await manageAccount(data)
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '已保存', icon: 'success' })
        this.setData({ editVisible: false })
        this.loadAccounts()
      } else {
        wx.showToast({ title: res.error || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async deleteAccount(e) {
    const id = e.currentTarget.dataset.id
    const res = await wx.showModal({ title: '确认删除', content: '删除后无法恢复' })
    if (!res.confirm) return

    wx.showLoading({ title: '删除中...' })
    try {
      const res = await manageAccount({ action: 'delete', id })
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '已删除', icon: 'success' })
        this.loadAccounts()
      } else {
        wx.showToast({ title: res.error || '删除失败', icon: 'none', duration: 2500 })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },
})
