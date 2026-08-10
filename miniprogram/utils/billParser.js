/**
 * billParser.js - 前端账单解析封装
 *
 * 职责：上传文件到云存储 → 调用 parseBill 云函数 → 返回解析结果
 * 前端页面只调这个模块，不直接处理解析逻辑。
 *
 * 流程：
 *   1. wx.cloud.uploadFile 上传文件到云存储
 *   2. wx.cloud.callFunction 调 parseBill，传 fileID + format
 *   3. 云端解析后返回 record 数组
 *   4. 前端拿 record 逐条调 addTransaction（去重由 addTransaction 处理）
 */

/**
 * 上传并解析账单
 * @param {string} filePath 本地文件路径（wx.chooseMessageFile 返回）
 * @param {string} format 'wechat' | 'alipay' | 'bank' | 'generic'
 * @param {string} fileName 原始文件名（用于判断 Excel vs CSV）
 * @returns {Promise<{success, data, total, detectedRows}>}
 */
function parse(filePath, format, fileName) {
  return new Promise((resolve, reject) => {
    // 1. 上传到云存储
    const cloudPath = `bills/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (uploadRes) => {
        const fileID = uploadRes.fileID

        // 2. 调云函数解析
        wx.cloud.callFunction({
          name: 'parseBill',
          data: { fileID, format, fileName },
          success: (res) => {
            // 3. 解析完删掉云存储里的临时文件（可选）
            wx.cloud.deleteFile({ fileList: [fileID] })

            resolve(res.result)
          },
          fail: (err) => {
            // 解析失败也清理临时文件
            wx.cloud.deleteFile({ fileList: [fileID] })
            reject(err)
          }
        })
      },
      fail: (err) => reject(err),
    })
  })
}

module.exports = { parse }
