/**
 * 完整模式维基文本解析工作线程
 * 
 * 功能说明：
 * 1. 解析维基文本格式，提取所有类型的信息
 * 2. 使用 wtf_wikipedia 库进行维基文本解析
 * 3. 提取内容包括：图片、坐标、信息框、分类、链接、纯文本
 * 4. 对链接进行分组处理，按类型分类
 * 5. 清理空数据字段，优化输出结构
 * 
 * 输出格式：
 * - images: 图片信息数组（清理了空的 links 字段）
 * - coordinates: 地理坐标信息
 * - infoboxes: 信息框数据
 * - categories: 页面分类
 * - links: 按类型分组的链接信息
 * - plaintext: 纯文本内容
 * 
 * 使用场景：
 * - 需要完整维基页面信息的应用
 * - 数据分析和挖掘
 * - 内容管理系统
 */

const wtf = require('wtf_wikipedia')
var _ = require("lodash")

/**
 * 链接类型分组函数
 * @param {Object} item - 链接对象
 * @returns {string} 链接类型
 */
const linksTypeGroup = (item) => {
    return item.type
}

/**
 * 提取维基文本的主要解析函数
 * 
 * 处理流程：
 * 1. 使用 wtf_wikipedia 解析输入文本
 * 2. 提取完整信息（图片、坐标、信息框、分类、纯文本）
 * 3. 处理链接数据：去重、分组、清理字段
 * 4. 清理空字段，优化输出结构
 * 5. 特殊处理图片数据中的空 links 字段
 * 
 * @param {string} wikiText - 待解析的维基文本内容
 * @returns {Object} 解析后的结构化数据
 */
function extract_wiki_text(wikiText) {
    // 第一步：使用 wtf_wikipedia 库解析维基文本
    let doc = wtf(wikiText)
    
    // 第二步：提取完整信息，启用所有数据类型（除了 sections）
    let data = doc.json({ 
        images: true,        // 启用图片信息
        sections: false,     // 禁用章节信息（通常数据量大且不常用）
        coordinates: true,   // 启用地理坐标
        infoboxes: true,     // 启用信息框
        categories: true,    // 启用分类信息
        plaintext: true      // 启用纯文本提取
    })
    
    // 第三步：处理链接数据
    // 使用 lodash 链式操作处理链接：
    // 1. 获取所有链接的 data 属性
    // 2. 根据 raw 字段去重（避免重复链接）
    // 3. 按链接类型分组
    // 4. 清理每个链接项的 type 和 raw 字段（减少冗余数据）
    let linkGroup = _.chain(doc.links())
        .map(item => item.data)
        .uniqBy("raw")
        .groupBy(linksTypeGroup)
        .mapValues(items => {
            return items.map(item => {
                delete (item.type)  // 删除类型字段（已用于分组）
                delete (item.raw)   // 删除原始文本字段
                return item
            })
        }).value()
    
    // 第四步：将处理后的链接数据添加到主数据对象
    if (Object.keys(linkGroup).length > 0) {
        data.links = linkGroup
    }

    // 第五步：清理空数据字段
    // 遍历可能为空的字段，如果长度为 0 则删除
    for (let key of ['coordinates', 'infoboxes', 'images', 'links', 'categories']) {
        if (data[key] && data[key].length === 0)
            delete data[key]
    }

    // 第六步：特殊处理图片数据
    // 注意：wtf_wikipedia 的图片对象中的 links 字段通常为空数组
    // 删除这些空的 links 字段以减少数据冗余
    if (data['images']?.length > 0) {
        data['images'] = data['images'].map(item => {
            delete item['links']
            return item
        })
    }

    return data
}

module.exports = extract_wiki_text
