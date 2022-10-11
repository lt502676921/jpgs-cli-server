'use strict'

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app
  router.get('/project/template', controller.project.getTemplate)
  router.get('/redis/test', controller.project.getRedis)

  router.get('/test', controller.project.test)
  router.resources('components', '/api/v1/components', controller.v1.components)
  router.resources('componentSite', '/api/v1/componentSite', controller.v1.componentSite)

  app.io.route('build', app.io.controller.build.index)
}
