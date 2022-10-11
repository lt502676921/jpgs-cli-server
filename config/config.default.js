/* eslint valid-jsdoc: "off" */

'use strict'

const { REDIS_HOST, REDIS_PORT, REDIS_PWD, MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PWD } = require('./db')

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {})

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1647566367644_7405'

  // add your middleware config here
  config.middleware = []

  // add WebSocket Server config
  config.io = {
    namespace: {
      '/': {
        connectionMiddleware: ['auth'],
        packetMiddleware: ['filter'],
      },
    },
  }

  config.redis = {
    client: {
      port: REDIS_PORT,
      host: REDIS_HOST,
      password: REDIS_PWD,
      db: 0,
    },
  }

  config.mysql = {
    client: {
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DB,
      user: MYSQL_USER,
      password: MYSQL_PWD,
    },
    app: true,
    agent: false,
  }

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  }

  config.security = {
    csrf: {
      enable: false,
    },
  }

  config.cors = {
    origin: '*',
  }

  return {
    ...config,
    ...userConfig,
  }
}
