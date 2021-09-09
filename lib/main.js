const core = require('@actions/core')
const github = require('@actions/github')
const globby = require('globby')
const fs = require('fs')
const path = require('path')
const NpmRegistry = require('./npm.js')

async function run() {
  try {
    core.debug(
      ` Available environment variables:\n -> ${Object.keys(process.env)
        .map(i => i + ' :: ' + process.env[i])
        .join('\n -> ')}`
    );

    // Fail when no registry credentials have been passed
    if (!process.env.hasOwnProperty('REGISTRY_TOKEN') && !process.env.hasOwnProperty('REGISTRY_CREDENTIALS')) {
      core.setFailed('Missing REGISTRY_TOKEN or REGISTRY_CREDENTIALS.');
      return;
    }

    // Set registry credentials or token
    const token = process.env.REGISTRY_TOKEN;
    const credentials = process.env.REGISTRY_CREDENTIALS ? Buffer.from(process.env.REGISTRY_CREDENTIALS.trim()).toString('base64') : undefined;

    // Set the npm registry to pusblish to
    const npm_registry = core.getInput('registry', { required: false });

    // Set specific version if passed
    const version = process.env.TAG;

    // Set directories that should be scanned
    const scan = (core.getInput('scan', { required: false })).split(',').map(dir => path.join(process.env.GITHUB_WORKSPACE, dir.trim(), '/**/package.json'))
    console.log(`Directories to scan:\n\t- ${scan.join('\n\t- ')}`)

    // Set options for the npmrc file
    const npmrc_options = core.getInput('npmrc-options', { required: false }).trim().split(',')

    // Set a boolean when publishing a single element
    const single_element = (core.getInput('single-element', { required: false })).trim() === 'true'

    // Construct the NpmRegistry
    const npm = new NpmRegistry(token, credentials, npm_registry, npmrc_options)

    // Scan for elements
    const paths = new Set(await globby(scan.concat(['!**/node_modules'])))
    if (paths.size === 0) {
      core.debug('Paths:\n' + Array.from(paths).join('\n'))
      core.setFailed('No elements detected in the given directories (could not find package.json).')
      return
    }

    // Loop through elements and try to publish
    let publications = new Set()
    paths.forEach(file => {
      file = path.resolve(file)
      console.log(`Attempting to publish from "${file}"`)
      const content = JSON.parse(fs.readFileSync(file))
      const saveContent = fs.writeFileSync

      // Publisch logic
      try {
        // Construct an .npmrc file
        npm.config(path.dirname(file));
        // If version is set, ignore current version otherwise bump patch. 
        if(version && !single_element) {
          console.log(`Setting new version of ${content.name} to ${version}`);
          content.version = version;
          saveContent(file, JSON.stringify(content, null, 2))
        } else {
          const current_version = npm.version(path.dirname(file), content.name);
          if (current_version){
            console.log(`Current version of ${content.name} is ${current_version}. Incrementing Patch...`);
            npm.patch(path.dirname(file));
          } else {
            console.log(`No previous version of ${content.name} found. Setting initial version to "0.0.1"...`);
            content.version = '0.0.1';
            saveContent(file, JSON.stringify(content, null, 2))
          }
        }
        npm.publish(path.dirname(file))
        publications.add(`${content.name}@${content.version}`)
      } catch (e) {
        core.warning(e.message)
      }
    })

    if (publications.size === 0) {
      core.setFailed('Did not successfully publish any modules.')
      return
    }

    core.setOutput('modules', Array.from(publications).join(', '))
  } catch (e) {
    core.setFailed(e.message)
  }
}

run()
