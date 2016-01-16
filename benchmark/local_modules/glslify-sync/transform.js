const staticModule = require('static-module')
const through      = require('through2')
const glslify      = require('glslify')
const nodeResolve  = require('resolve')
const path         = require('path')

module.exports = glslifySyncTransform

function glslifySyncTransform(filename, opts) {
  if (path.extname(filename) === '.json') return through()

  const transformer = staticModule({
    'glslify-sync': glslifyReplace
  }, {
    vars: {
      __dirname: path.dirname(filename),
      __filename: filename,
      require: {
        resolve: nodeResolve
      }
    }
  })

  return transformer

  function glslifyReplace(glslFile, opts) {
    const origin = './' + path.relative(path.dirname(filename), __dirname)
    const stream = through()

    opts = opts || {}
    opts.basedir = opts.basedir || path.dirname(filename)

    glslify.bundle(glslFile, opts, function(err, source) {
      if (err) return transformer.emit('error', err)

      //stream.push('require("'+origin+'/wrapper")(')
      stream.push(JSON.stringify(source))
      //stream.push(')')
      stream.push(null)

    }).on('file', function(file) {
      transformer.emit('file', file)
    })

    return stream
  }
}
