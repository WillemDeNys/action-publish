const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

class npm {
  constructor(token, credentials, registry = '//registry.npmjs.org', options) {
    if ((!token || token.trim().length === 0) && (!credentials || credentials.trim().length === 0)) {
      throw new Error('Missing REGISTRY_TOKEN or REGISTRY_CREDENTIALS.')
    }

    this.token = token
    this.credentials = credentials
    this.registry = registry || '//registry.npmjs.org'
    this.options = options
  }

  config(dir) {
    dir = path.resolve(dir)

    let npmrc = this.npmrc()
    let npmrcFile = path.join(dir, '.npmrc')

    if (fs.existsSync(npmrcFile)) {
      fs.unlinkSync(npmrcFile)
    }
    console.log('Writing to', npmrcFile)
    console.log('npmrc content: ', npmrc.replace(this.token, 'TOKEN').replace(this.credentials, 'CREDENTIALS'))
    console.log('------')
    fs.writeFileSync(npmrcFile, npmrc)
  }

  npmrc() {
    let npmrc = ''
    if (this.options) {
      npmrc += this.options.join('\n').trim()
    }
    if (this.token) {
      console.log('npmrc uses REGISTRY_TOKEN')
      return npmrc += `\nregistry=${this.registry}\n_authToken=${this.token.trim()}`
    } else {
      console.log('npmrc uses REGISTRY_CREDENTIALS')
      return npmrc += `\nregistry=${this.registry}\n_auth=${this.credentials}`
    }
  }

  publish(dir) {
    const cmd = 'npm publish --verbose';

    let response = execSync(cmd, { cwd: dir })

    if (response.indexOf('npm ERR!') >= 0) {
      throw new Error(response)
    }
  }

  version(package) {
    const cmd = `npm show ${package} verion`;

    let response = execSync(cmd);

    if (response.indexOf('npm ERR!') >= 0) {
      return;
    }

    return response.toString();
  }

  patch(dir) {
    const cmd = 'npm version patch';

    let response = execSync(cmd, { cwd: dir })

    if (response.indexOf('npm ERR!') >= 0) {
      throw new Error(response)
    }
  }
}

module.exports = npm
