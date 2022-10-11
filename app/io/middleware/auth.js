'use strict'

const { createCloudBuildTask } = require('../../models/CloudBuildTask')

const REDIS_PREFIX = 'cloudbuild'

module.exports = () => {
  return async (ctx, next) => {
    const { app, socket, logger, helper } = ctx
    const { id } = socket
    const { redis } = app
    // const task = id
    const query = socket.handshake.query
    try {
      socket.emit(
        id,
        helper.parseMsg('connect', {
          type: 'connect',
          message: '云构建服务连接成功',
        })
      )
      let hasTask = await redis.get(`${REDIS_PREFIX}:${id}`)
      if (!hasTask) {
        await redis.set(`${REDIS_PREFIX}:${id}`, JSON.stringify(query))
      }
      hasTask = await redis.get(`${REDIS_PREFIX}:${id}`)
      logger.info('query', hasTask)
      await next()
      // 清除缓存文件
      const cloudBuildTask = await createCloudBuildTask(ctx, app)
      await cloudBuildTask.clean()
      console.log('disconnect!')
    } catch (e) {
      logger.error('build error', e.message)
      // 清除缓存文件
      const cloudBuildTask = await createCloudBuildTask(ctx, app)
      await cloudBuildTask.clean()
    }
  }
}
