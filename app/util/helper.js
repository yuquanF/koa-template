/**
 * 找到obj对象中（包含原型链上的key）满足传入给定条件之一的key，并返回这个key数组
 * @param obj
 * @param filter
 * @param prefix
 * @param specifiedType
 * @return {array}
 */
function findMembers(obj, { filter, prefix, specifiedType }) {
  // 如果没有传入过滤条件，直接返回空数组
  if (!filter && !prefix && !specifiedType) {
    return []
  }

  // 递归函数
  function _find(obj) {
    // 基线条件（跳出递归）
    if (obj.__proto__ === null) {
      return []
    }

    let keys = Reflect.ownKeys(obj)
    keys = keys.filter((key) => {
      // 过滤掉不满足条件的属性或方法名
      return _shouldKeep(key)
    })

    return [...keys, ..._find(obj.__proto__)]
  }

  /**
   * 当传入的key值满足三个条件之一时，返回true
   * 条件一：如果存在filter，且满足这个传入的filter
   * 条件二：如果存在prefix，且key有这个前缀
   * 条件一：如果存在specifiedType，且obj[key]是这个类型
   * @param key
   * @returns {boolean}
   * @private
   */
  function _shouldKeep(key) {
    // 通过传入的filter，判断当前的值是否需要保留
    if (filter && filter(key)) {
      return true
    }
    if (prefix && key.startsWith(prefix)) {
      return true
    }
    if (specifiedType && obj[key] instanceof specifiedType) {
      return true
    }
  }

  return _find(obj)
}

module.exports = {
  findMembers
}
