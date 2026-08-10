// pages/import/import.js
//
// 这个页面只负责：
//   1. 选格式、选账户、选文件（UI）
//   2. 调 billParser 上传+解析（调云函数）
//   3. 预览解析结果
//   4. 确认后逐条调 addTransaction（去重由云端指纹处理）
//
// 所有解析逻辑（CSV 拆行、日期/金额清洗、银行列头识别、Excel 解析）
// 都在 cloudfunctions/parseBill/parsers/ 下，改解析器不用动这个文件。

const { getAccounts, addTransaction } = require('../../utils/api.js')
const { parse: parseBill } = require('../../utils/billParser.js')
const { formatMoney } = require('../../utils/format.js')

Page({
  data: {
    accounts: [],
    accountNames: ['请先选择账户'],
    accountIdx: 0,
    selectedAccount: null,
    formats: [
      { value: 'wechat', label: '微信支付账单', desc: '微信「我-服务-钱包-账单-常见问题-导出账单」' },
      { value: 'alipay', label: '支付宝账单', desc: '支付宝「我的-账单-右上角-开具交易流水」' },
      { value: 'bank', label: '银行流水（智能识别）', desc: '招行/工行/建行/农行/中行等，自动识别列头' },
      { value: 'generic', label: '通用CSV', desc: '金额,时间,商户,分类（自定义格式）' },
    ],
    selectedFormat: 'wechat',
    fileName: '',
    filePath: '',
    loading: false,
    parsedRecords: null,  // 解析后的预览数据
    result: null,          // 导入结果
  },

  onShow() {
    this.loadAccounts()
  },

  async loadAccounts() {
    try {
      const res = await getAccounts()
      if (res.success) {
        const names = res.data.map(a => a.icon + ' ' + a.name)
        this.setData({
          accounts: res.data,
          accountNames: names.length > 0 ? names : ['请先添加账户'],
        })
        if (res.data.length > 0) {
          this.setData({ selectedAccount: res.data[0] })
        }
      }
    } catch (e) {
      console.error('加载账户失败:', e)
    }
  },

  onAccountChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      accountIdx: idx,
      selectedAccount: this.data.accounts[idx - 1] || null,
    })
  },

  selectFormat(e) {
    this.setData({
      selectedFormat: e.currentTarget.dataset.format,
      parsedRecords: null,
      result: null,
    })
  },

  // 选文件（支持 CSV 和 Excel）
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv', 'xlsx', 'xls'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({
          fileName: file.name,
          filePath: file.path,
          parsedRecords: null,
          result: null,
        })
        // 选完文件自动解析预览
        this.parsePreview()
      },
      fail: () => {},
    })
  },

  // 上传+解析，显示预览
  async parsePreview() {
    const { filePath, selectedFormat, fileName } = this.data
    if (!filePath) return

    if (!this.data.selectedAccount) {
      wx.showToast({ title: '请先选择账户', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.showLoading({ title: '解析中...' })

    try {
      const res = await parseBill(filePath, selectedFormat, fileName)
      wx.hideLoading()
      this.setData({ loading: false })

      if (res.success) {
        // 缓存全量数据供导入用
        this._allRecords = res.data

        // 取前 20 条做预览
        const preview = res.data.slice(0, 20).map(r => ({
          ...r,
          amountStr: r.amount.toFixed(2),
          dateStr: new Date(r.timestamp).toLocaleDateString('zh-CN'),
        }))
        this.setData({
          parsedRecords: { preview, total: res.total },
        })
      } else {
        wx.showToast({ title: res.error || '解析失败', icon: 'none', duration: 3000 })
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: '解析失败', icon: 'none', duration: 3000 })
      console.error('解析失败:', e)
    }
  },

  // 确认导入：逐条调 addTransaction，云端自动去重
  async doImport() {
    const { parsedRecords, selectedAccount, selectedFormat } = this.data
    if (!parsedRecords || !selectedAccount) return

    this.setData({ loading: true })
    wx.showLoading({ title: '导入中...' })

    // 从云函数重新拿全量数据（预览只有前 20 条）
    // 实际上 parsedRecords 只存了预览，需要重新解析拿全量
    // 这里用预览数据 + 重新解析拿全量
    // 更好的做法：parsePreview 时缓存全量 records
    const allRecords = this._allRecords || []

    let imported = 0, skipped = 0, errors = 0

    for (let i = 0; i < allRecords.length; i++) {
      const r = allRecords[i]
      try {
        const res = await addTransaction({
          amount: r.amount,
          type: r.type,
          accountId: selectedAccount._id,
          merchant: r.merchant,
          note: r.note || '',
          timestamp: r.timestamp,
          source: selectedFormat + '_bill',
        })

        if (res.duplicate) {
          skipped++
        } else {
          imported++
        }
      } catch (e) {
        errors++
        console.error('导入第' + (i + 1) + '条失败:', e)
      }
    }

    wx.hideLoading()
    this.setData({ loading: false })

    this.setData({
      result: {
        total: allRecords.length,
        imported,
        skipped,
        errors,
      },
    })

    wx.showToast({
      title: `导入 ${imported} 条，跳过 ${skipped} 条重复`,
      icon: 'none',
      duration: 3000,
    })
  },
})
