const validator = require('validator')
const _ = require('lodash')
const { findMembers } = require('./helper')
const ParameterException = require('../exception/http/ParameterException')

/**
 * 自定义参数验证器，所有具体的参数验证器必须继承该类，并按照规定的格式书写成员
 * 规则一：
 *     需要验证的成员变量, 需要传入一个Rule实例对象的数组，数组所有元素必须为Rule的实例对象，具体Rule可定义的名称，参考validator.js
 *     this.xxx = [
 *       new Rule(),
 *       new Rule(),
 *       ...
 *     ]
 * 规则二：
 *     可定义自定义的验证方法，方法名需要以validate为方法名前缀。校验失败时，自定义的校验方法应该抛出错误
 *     例如 function validatePassword() {}
 *
 * @params, 用于保存前端传递过来的参数
 * @paramsChecked，保存已经校验通过的参数，并合并了可选参数的默认值（当前端没传时）
 */
class BaseValidator {
  params
  paramsChecked
  memberKeys

  constructor(ctx) {
    this._initParams(ctx)
  }

  _initParams(ctx) {
    // 找到ctx中所有传递过来的参数
    const params = this._assembleAllParams(ctx)

    // _.cloneDeep(value), https://www.lodashjs.com/docs/lodash.cloneDeep
    // 这个方法类似_.clone，除了它会递归拷贝 value。（注：也叫深拷贝, 不会指向同一对象）
    this.params = _.cloneDeep(params)
    this.paramsChecked = _.cloneDeep(params)
  }

  /**
   * 获取已校验过的参数值, 或原始参数值
   * @param path, 以"." 作为分隔符传入的路径，例如 a.b.c
   * @param parsed, 表明是否是已处理过的对象，默认true
   * @returns {string|any}
   */
  get(path, parsed = true) {
    if (parsed) {
      // _.get(object, path, [defaultValue]), https://www.lodashjs.com/docs/lodash.get
      // 根据 object 对象的path路径获取值。 如果解析 value 是 undefined 会以 defaultValue 取代。
      const value = _.get(this.paramsChecked, path, null)

      if (!value) {
        // _.last(array), 获取array中的最后一个元素。 https://www.lodashjs.com/docs/lodash.last
        return _.get(this.paramsChecked.default, _.last(path.split('.')))
      }
      return value
    } else {
      return _.get(this.params, path)
    }
  }

  /**
   * 验证参数
   * 使用async的原因是考虑到一些自定义验证方法中可能存在异步操作
   * @returns {Promise<BaseValidator>}
   */
  async validate() {
    // 找到this中所有满足规则1,2的key数组
    this.memberKeys = findMembers(this, {
      filter: this._findMembersFilter.bind(this)
    })

    const errorMessages = []

    // 校验：通过Relu实例对象和自定义validate方法
    // 验证通过会返回this，没有则抛出参数校验错误
    for (const memberKey of this.memberKeys) {
      const result = await this._check(memberKey)
      if (!result.success) {
        errorMessages.push(result.message)
      }
    }
    if (errorMessages.length !== 0) {
      throw new ParameterException(10001, errorMessages)
    }

    return this
  }

  async _check(key) {
    let result
    // 判断是否是标准的函数，用于自定义的以validate开头的校验函数
    const isCustomFunc = typeof this[key] == 'function'
    if (isCustomFunc) {
      try {
        await this[key](this.params) // 校验失败时，自定义的校验方法应该抛出错误
        result = new RuleResult(true) // 校验成功
      } catch (error) {
        result = new RuleResult(false, error.message || '参数错误')
      }
    } else {
      // 找到前端传入的对应名称的参数值
      const param = this._findParam(key)
      // 属性验证，是数组，内有一组Rule
      const rules = this[key]

      // 字段校验
      result = new RuleField(rules, this, key).validate(param.value)
      // 通过
      if (result.pass) {
        // 如果参数路径不存在，往往是因为用户传了空值，而又设置了默认值
        if (param.path.length === 0) {
          _.set(this.paramsChecked, ['default', key], result.legalValue)
        } else {
          _.set(this.paramsChecked, param.path, result.legalValue)
        }
      }
    }

    if (!result.pass) {
      const message = `${isCustomFunc ? '' : key + '：'}${result.message}`
      return {
        message: message,
        success: false
      }
    }
    return {
      message: 'ok',
      success: true
    }
  }

  /**
   * 从koa的上下文ctx中，找到所有传递过来的参数
   * @param ctx
   * @returns {object}
   * @private
   */
  _assembleAllParams(ctx) {
    return {
      body: ctx.request.body,
      query: ctx.request.query,
      path: ctx.params,
      header: ctx.request.header
    }
  }

  _findMembersFilter(key) {
    // 以validate开头的key保留
    if (/validate([A-Z])\w+/g.test(key)) {
      return true
    }
    // this[key]是数组类型的，数组元素必须全部是Rule实例对象
    if (this[key] instanceof Array) {
      this[key].forEach((v) => {
        const isRuleType = v instanceof Rule
        if (!isRuleType) {
          // 这里是参数验证器编写错误，属于服务端错误
          throw new Error(
            `${this.constructor.name}校验器中${key}字段的验证数组必须全部为Rule类型`
          )
        }
      })
      return true
    }
    // 其他类型的key全部过滤掉
    return false
  }

  _findParam(key) {
    let value
    value = _.get(this.params, ['query', key])
    if (value) {
      return {
        value,
        path: ['query', key]
      }
    }
    value = _.get(this.params, ['body', key])
    if (value) {
      return {
        value,
        path: ['body', key]
      }
    }
    value = _.get(this.params, ['path', key])
    if (value) {
      return {
        value,
        path: ['path', key]
      }
    }
    value = _.get(this.params, ['header', key])
    if (value) {
      return {
        value,
        path: ['header', key]
      }
    }
    return {
      value: null,
      path: []
    }
  }
}

/**
 * 一条规则
 */
class Rule {
  constructor(name, message, ...options) {
    Object.assign(this, { name, message, options })
  }

  validate(value) {
    // 自定义一个可选的规则，遇到这个规则，则直接校验通过。约定可选时，第3个参数不是option，而是一个defaultValue
    if (this.name === 'isOptional') {
      return new RuleResult(true)
    }
    // 调用validator.js 校验，不通过
    if (!validator[this.name](value + '', ...this.options)) {
      return new RuleResult(false, this.message || '参数错误')
    }
    // validator.js 校验通过
    return new RuleResult(true, '')
  }
}

/**
 * 一个字段包含多条Rule
 */
class RuleField {
  constructor(rules, target, field) {
    this.rules = rules
    this.target = target
    this.field = field
  }

  validate(value) {
    if (value == null) {
      // 如果字段为空，表示前端未传入这个参数。接下来需要判断该参数是否允许为空，有默认值
      const allowEmpty = this._allowEmpty()
      const defaultValue = this._hasDefault()
      if (allowEmpty) {
        if (!defaultValue) {
          throw new Error(
            `${this.target.constructor.name}校验器中${this.field}字段没有对可选参数设置默认的参数值！`
          )
        }
        return new RuleFieldResult(true, '', defaultValue)
      } else {
        return new RuleFieldResult(false, '字段是必填参数')
      }
    }

    // 校验没有全通过
    const filedResult = new RuleFieldResult(false)
    const errorMessages = []
    for (const rule of this.rules) {
      let result = rule.validate(value)
      if (!result.pass) {
        errorMessages.push(result.message)
      }
    }
    if (errorMessages.length !== 0) {
      filedResult.legalValue = null
      filedResult.message = errorMessages
      return filedResult
    }

    // 全部校验通过
    return new RuleFieldResult(true, '', this._convert(value))
  }

  _allowEmpty() {
    for (let rule of this.rules) {
      if (rule.name === 'isOptional') {
        return true
      }
    }
    return false
  }

  _hasDefault() {
    for (let rule of this.rules) {
      if (rule.name === 'isOptional') {
        return rule.options[0]
      }
    }
  }

  _convert(value) {
    for (let rule of this.rules) {
      if (rule.name === 'isInt') {
        return parseInt(value)
      }
      if (rule.name === 'isFloat') {
        return parseFloat(value)
      }
      if (rule.name === 'isBoolean') {
        return !!value
      }
    }
    return value
  }
}

class RuleResult {
  constructor(pass, message = '') {
    Object.assign(this, {
      pass,
      message
    })
  }
}

class RuleFieldResult extends RuleResult {
  constructor(pass, message = '', legalValue = null) {
    super(pass, message)
    this.legalValue = legalValue
  }
}

module.exports = {
  Rule,
  BaseValidator
}
