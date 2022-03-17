const Router = require('koa-router')
const requireDirectory = require('require-directory')
const path = require('path')

class Init {
    static initCore(app) {
        Init.app = app
        Init.initLoadRouters()
        Init.initLoadHttpException()
        Init.initLoadConfig()
    }

    static initLoadRouters() {
        const apiDirectory = path.normalize(`${process.cwd()}/app/api`)
        requireDirectory(module, apiDirectory, {
            visit: obj => {
                if (obj instanceof Router) {
                    Init.app.use(obj.routes(), obj.allowedMethods())
                }
            },
        })
    }

    static initLoadHttpException() {
        const exceptionDirectory = path.normalize(`${process.cwd()}/exception`)
        global.errs = requireDirectory(module, exceptionDirectory)
    }

    static initLoadConfig () {
        const configPath = path.normalize(`${process.cwd()}/config/config.js`)
        global.config = require(configPath)
    }
}

module.exports = Init