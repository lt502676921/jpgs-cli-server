'use strict'
const Controller = require('egg').Controller
const axios = require('axios')
const { decode } = require('js-base64')
const constant = require('../../const')
const ComponentService = require('../../service/ComponentService')
const VersionService = require('../../service/VersionService')
const ComponentTask = require('../../models/ComponentTask')
const { success, failed } = require('../../utils/request')
const { formatName } = require('../../utils')

class ComponentsController extends Controller {
  async index() {
    const { ctx, app } = this
    const { name } = ctx.query
    const searchName = name ? `AND c.name LIKE ?` : ''
    const replaceValues = name ? [`%${name}%`] : [] // 防止sql注入
    const sql = `SELECT c.id, c.name, c.classname, c.description, c.npm_name, c.npm_version, 
c.git_type, c.git_remote, c.git_owner, c.git_login, c.create_dt, c.update_dt,
v.version, v.build_path, v.example_path, v.example_list
FROM component AS c
LEFT JOIN version AS v ON v.component_id = c.id 
WHERE c.status = 1 AND v.status = 1 ${searchName}
ORDER BY c.create_dt, v.version DESC`
    const result = await app.mysql.query(sql, replaceValues)
    const components = []
    result.forEach(component => {
      let hasComponent = components.find(item => component.id === item.id)
      if (!hasComponent) {
        hasComponent = {
          ...component,
        }
        delete hasComponent.version
        delete hasComponent.build_path
        delete hasComponent.example_path
        delete hasComponent.example_list
        hasComponent.versions = []
        components.push(hasComponent)
      }
      hasComponent.versions.push({
        version: component.version,
        build_path: component.build_path,
        example_path: component.example_path,
        example_list: component.example_list,
      })
    })
    ctx.body = components
  }

  async show() {
    const { ctx, app } = this
    const id = ctx.params.id
    const results = await app.mysql.select('component', { where: { id } })
    if (results && results.length > 0) {
      const component = results[0]
      component.versions = await app.mysql.select('version', {
        where: { component_id: id },
        orders: [['version', 'desc']],
      })
      // github: https://api.github.com/repos/{owner}/{repo}/{path}
      // github open API文档：https://docs.github.com/cn/rest
      // gitee: https://gitee.com/api/v5/repos/{owner}/{repo}/contents/{path}
      // gitee open API文档：https://gitee.com/api/v5/swagger#/getV5ReposOwnerRepoStargazers?ex=no
      let readmeUrl
      const name = formatName(component.classname)
      if (component.git_type === 'gitee') {
        readmeUrl = `https://gitee.com/api/v5/repos/${component.git_login}/${name}/contents/README.md`
      } else {
        readmeUrl = `https://api.github.com/repos/${component.git_login}/${name}/readme`
      }
      try {
        const readme = await axios.get(readmeUrl)
        let content = readme.data && readme.data.content
        if (content) {
          content = decode(content)
          if (content) {
            component.readme = content
          }
        }
      } catch (error) {
        console.log('fetchReadmeError', error)
      }
      ctx.body = component
    } else {
      ctx.body = {}
    }
  }

  async create() {
    const { ctx, app } = this
    const { component, git } = ctx.request.body
    const timestamp = new Date().getTime()
    // 1. 添加组件信息
    const componentData = {
      name: component.name,
      classname: component.className,
      description: component.description,
      npm_name: component.npmName,
      npm_version: component.npmVersion,
      git_type: git.type,
      git_remote: git.remote,
      git_owner: git.owner,
      git_login: git.login,
      status: constant.STATUS.ON,
      create_dt: timestamp,
      create_by: git.login,
      update_dt: timestamp,
      update_by: git.login,
    }
    const componentService = new ComponentService(app)
    const haveComponentInDB = await componentService.queryOne({ classname: componentData.classname })
    let componentId
    if (!haveComponentInDB) {
      componentId = await componentService.insert(componentData)
    } else {
      componentId = haveComponentInDB.id
    }
    if (!componentId) {
      ctx.body = failed('添加组件失败')
      return
    }
    // 2. 添加组件的版本信息
    const versionData = {
      component_id: componentId,
      version: git.version,
      build_path: component.buildPath,
      example_path: component.examplePath,
      example_list: JSON.stringify(component.exampleList),
      status: constant.STATUS.ON,
      create_dt: timestamp,
      create_by: git.login,
      update_dt: timestamp,
      update_by: git.login,
    }
    const versionService = new VersionService(app)
    const haveVersionInDB = await versionService.queryOne({ component_id: componentId, version: versionData.version })
    if (!haveVersionInDB) {
      const versionRes = await versionService.insert(versionData)
      if (!versionRes) {
        ctx.body = failed('添加组件失败')
        return
      }
    } else {
      const updateData = {
        build_path: component.buildPath,
        example_path: component.examplePath,
        example_list: JSON.stringify(component.exampleList),
        update_dt: timestamp,
        update_by: git.login,
      }
      const versionRes = await versionService.update(updateData, {
        component_id: componentId,
        version: versionData.version,
      })
      if (!versionRes) {
        ctx.body = failed('更新组件失败')
        return
      }
    }
    // 3. 向OSS中上传组件预览文件
    const task = new ComponentTask(
      {
        repo: git.remote,
        version: git.version,
        name: component.className,
        branch: git.branch,
        buildPath: component.buildPath,
        examplePath: component.examplePath,
      },
      { ctx }
    )
    try {
      // 3.1 下载和构建源码
      await task.downloadSourceCode()
      // 3.2 组件构建
      await task.publishBuild()
      // 3.3 上传组件多预览文件
      await task.publishExample()
      ctx.body = success('添加组件成功', {
        component: await componentService.queryOne({ id: componentId }),
        version: await versionService.queryOne({ component_id: componentId, version: versionData.version }),
      })
    } catch (error) {
      ctx.logger.error(error)
      ctx.body = failed('添加组件失败，失败原因：' + error.message)
    }
  }
}

module.exports = ComponentsController
