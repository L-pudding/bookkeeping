/**
 * api.js - 云函数调用封装
 */

/**
 * 调用云函数的统一封装
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res.result),
      fail: (err) => {
        console.error(`[云函数 ${name}] 调用失败:`, err)
        reject(err)
      }
    })
  })
}

// 添加交易（含去重）
const addTransaction = (data) => callFunction('addTransaction', data)

// 查询交易列表
const getTransactions = (data) => callFunction('getTransactions', data)

// 获取账户列表
const getAccounts = () => callFunction('getAccounts', {})

// 管理账户（增删改）
const manageAccount = (data) => callFunction('manageAccount', data)

// 对账
const reconcile = (data) => callFunction('reconcile', data)

// 初始化数据（默认分类、默认账户）
const initData = () => callFunction('initData', {})

module.exports = {
  callFunction,
  addTransaction,
  getTransactions,
  getAccounts,
  manageAccount,
  reconcile,
  initData,
}
