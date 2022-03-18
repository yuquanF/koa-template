const {BaseValidator, Rule} = require('../util/BaseValidator')

class RegisterValidator extends BaseValidator {
    constructor(ctx) {
        super(ctx)
        this.email = [
            new Rule('isEmail', '电子邮箱不符合规范，请输入正确的邮箱'),
        ]
        this.password1 = [
            new Rule('isLength', '密码至少6个字符，最多32个字符', {
                min: 6,
                max: 32,
            }),
            new Rule('matches', '密码不符合规范', '^(?![0-9]+$)(?![a-z]+$)(?![A-Z]+$)(?![,\.#%\'\+\*\-:;^_`]+$)[,\.#%\'\+\*\-:;^_`0-9A-Za-z]{6,20}$'),
        ]
        this.password2 = this.password1
        this.nickname = [
            new Rule('isLength', '昵称不符合长度规范', {
                min: 4,
                max: 32,
            }),
        ]
        this.like = [
            new Rule('isLength', '爱好不符合长度规范', {
                min: 2,
                max: 32,
            }),
            new Rule('isOptional', '', '无'),
        ]
    }

    validatePassword(val) {
        const password1 = val.body.password1
        const password2 = val.body.password2
        if (password1 !== password2) {
            throw new Error('两个密码不一致')
        }
    }
}

module.exports = RegisterValidator