'use strict'

module.exports = () => {
  return async (ctx, next) => {
    //执行自定义事件之前调用
    await next()
    //执行自定义事件之后调用
  }
}
