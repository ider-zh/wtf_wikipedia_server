/**
 * 精简模式维基文本解析工作线程
 * 
 * 功能说明：
 * 1. 轻量级维基文本解析，仅提取核心信息
 * 2. 使用 wtf_wikipedia 库进行维基文本解析
 * 3. 仅提取：分类和链接信息
 * 4. 对链接进行分组处理，按类型分类
 * 5. 清理空数据字段，优化输出结构
 * 
 * 输出格式：
 * - categories: 页面分类信息
 * - links: 按类型分组的链接信息
 * 
 * 性能优势：
 * - 更快的解析速度（禁用大部分数据提取）
 * - 更小的内存占用
 * - 更适合高频调用场景
 * 
 * 使用场景：
 * - 需要快速获取页面基本信息的场景
 * - 链接分析和网络图谱构建
 * - 分类统计和分析
 * - 高并发API服务
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
 * 提取维基文本的精简解析函数
 * 
 * 处理流程：
 * 1. 使用 wtf_wikipedia 解析输入文本
 * 2. 仅提取分类和链接信息（禁用其他数据类型以提高性能）
 * 3. 处理链接数据：去重、分组、清理字段
 * 4. 清理空字段，优化输出结构
 * 
 * @param {string} wikiText - 待解析的维基文本内容
 * @returns {Object} 解析后的精简结构化数据
 */
function extract_wiki_text(wikiText) {
    // 第一步：使用 wtf_wikipedia 库解析维基文本
    let doc = wtf(wikiText)
    
    // 第二步：仅提取核心信息，禁用大部分数据类型以提高性能
    let data = doc.json({ 
        images: false,       // 禁用图片信息（通常数据量大）
        sections: false,     // 禁用章节信息
        coordinates: false,  // 禁用地理坐标
        infoboxes: false,    // 禁用信息框（结构复杂）
        categories: true,    // 启用分类信息（核心数据）
        plaintext: false     // 禁用纯文本（通常很长）
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
    // 仅检查 links 和 categories 字段（其他字段已禁用）
    for (let key of ['links', 'categories']) {
        if (data[key] && data[key].length === 0)
            delete data[key]
    }

    return data
}

module.exports = extract_wiki_text
