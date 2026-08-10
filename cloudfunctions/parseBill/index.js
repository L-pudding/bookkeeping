/**
 * parseBill 云函数 - 账单解析入口
 *
 * 职责：
 *   1. 从云存储下载用户上传的账单文件
 *   2. 判断是 Excel 还是 CSV，统一转成二维行数组
 *   3. 按 format 参数调度对应的解析器
 *   4. 返回解析后的 record 数组
 *
 * 入参：
 *   fileID: 云文件 ID（wx.cloud.uploadFile 返回）
 *   format: 'wechat' | 'alipay' | 'bank' | 'generic'
 *   fileName: 原始文件名（用于判断是否 Excel）
 *
 * 返回：
 *   { success: true, data: [{ amount, type, merchant, timestamp, note }, ...], total: N }
 *   { success: false, error: '...' }
 *
 * 模块结构：
 *   parseBill/
 *     index.js              ← 你在这里：入口，调度
 *     parsers/
 *       csvUtils.js         ← 共享工具（日期/金额/CSV拆行）
 *       excelParser.js      ← Excel → 行数组转换
 *       wechatParser.js     ← 微信账单
 *       alipayParser.js     ← 支付宝账单
 *       bankParser.js       ← 银行流水（智能识别）
 *       genericParser.js    ← 通用 CSV
 *
 * 新增格式的做法：
 *   1. 在 parsers/ 下新建 xxxParser.js，导出 parse(rows) 函数
 *   2. 在下方 FORMAT_MAP 里加一条映射
 *   3. 不需要改其他文件
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { csvTextToRows } = require('./parsers/csvUtils')
const { toArray: excelToArray, isExcelFile, isExcelByContent } = require('./parsers/excelParser')
const wechatParser = require('./parsers/wechatParser')
const alipayParser = require('./parsers/alipayParser')
const bankParser = require('./parsers/bankParser')
const genericParser = require('./parsers/genericParser')

// 格式 → 解析器 映射表
const FORMAT_MAP = {
  wechat: wechatParser,
  alipay: alipayParser,
  bank: bankParser,
  generic: genericParser,
}

exports.main = async (event, context) => {
  const { fileID, format = 'bank', fileName = '' } = event

  if (!fileID) {
    return { success: false, error: '缺少文件 ID' }
  }

  const parser = FORMAT_MAP[format]
  if (!parser) {
    return { success: false, error: `不支持的格式: ${format}` }
  }

  try {
    // 1. 从云存储下载文件
    const fileRes = await cloud.downloadFile({ fileID })
    const buffer = fileRes.fileContent

    // 2. 把文件转成二维行数组
    //    先按扩展名判断，再按文件内容判断（建行导出的 .csv 实际是 Excel）
    let rows
    if (isExcelFile(fileName) || isExcelByContent(buffer)) {
      rows = excelToArray(buffer)
    } else {
      // CSV：buffer 转文本，按行拆分
      const text = buffer.toString('utf-8')
      rows = csvTextToRows(text)
    }

    if (!rows || rows.length === 0) {
      return { success: false, error: '文件内容为空' }
    }

    // 3. 调用对应解析器
    const records = parser.parse(rows)

    // 4. 返回结果
    return {
      success: true,
      data: records,
      total: records.length,
      detectedRows: rows.length,
    }
  } catch (err) {
    console.error('parseBill 错误:', err)
    return { success: false, error: '解析失败: ' + (err.message || String(err)) }
  }
}
