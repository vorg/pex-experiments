var execSync = require('child_process').execSync;

function glslifySync(path) {
    return execSync(__dirname + '/node_modules/.bin/glslify ' + path, { encoding: 'utf8' });
}

module.exports = glslifySync;
