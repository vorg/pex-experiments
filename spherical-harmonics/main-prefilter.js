/*
sh_light(vec3 normal, SHC l){
  float x = normal.x;
  float y = normal.y;
  float z = normal.z;

  const float C1 = 0.429043;
  const float C2 = 0.511664;
  const float C3 = 0.743125;
  const float C4 = 0.886227;
  const float C5 = 0.247708;

  return (
    C4 * l.L00
    2.0 * C2 * l.L11  * x +
    2.0 * C2 * l.L1m1 * y +
    2.0 * C2 * l.L10  * z +
    //c5L20*3*z*z
    C3 * l.L20 * z * z + //?
     -C5 * l.L20 +
    2.0 * C1 * l.L2m2 * x * y +
    2.0 * C1 * l.L21  * x * z +
    2.0 * C1 * l.L2m1 * y * z +
    C1 * l.L22 * (x * x - y * y) +
  );
}
*/

var Window = require('pex-sys/Window')
var parseHdr = require('parse-hdr')
var GUI = require('./local_modules/pex-gui')
var envmapToCubemap = require('./local_modules/pex-envmap-to-cubemap')
var convolveCubemap = require('./local_modules/pex-convolve-cubemap')
var Vec3 = require('pex-math/Vec3')
var PointSpriteSolidColor = require('pex-materials/point-sprite-solid-color')
var PointSpriteShowColors = require('pex-materials/point-sprite-show-colors')
var random = require('pex-random')
var Arcball = require('pex-cam/Arcball')
var PerspCamera = require('pex-cam/PerspCamera')

var Settings = {
  width: 1280,
  height: 720,
  debug: true
}

var Resources = {
  // img: { binary: __dirname + '/assets/garage/garage.hdr' }
  img: { binary: __dirname + '/assets/pisa.hdr' }
}

var State = {
}

function round (v) {
  v[0] = Math.round(v[0] * 1000) / 1000
  v[1] = Math.round(v[1] * 1000) / 1000
  v[2] = Math.round(v[2] * 1000) / 1000
  return v
}

function hemisphereSample (Xi, N) {
  var Roughness = 1.0
  var a = Roughness * Roughness
  var Phi = 2.0 * Math.PI * Xi[0]
  var CosTheta = Math.sqrt((1.0 - Xi[1]) / (1.0 + (a * a - 1.0) * Xi[1]))
  var SinTheta = Math.sqrt(1.0 - CosTheta * CosTheta)
  var H = [0, 0, 0]
  H[0] = SinTheta * Math.cos(Phi)
  H[1] = SinTheta * Math.sin(Phi)
  H[2] = CosTheta

  // Tangent space vectors
  var UpVector = Math.abs(N[2]) < 0.999 ? [0.0, 0.0, 1.0] : [1.0, 0.0, 0.0]
  var TangentX = Vec3.normalize(Vec3.cross(Vec3.copy(UpVector), N))
  var TangentY = Vec3.normalize(Vec3.cross(Vec3.copy(N), TangentX))

  // Tangent to World Space
  var result = [0, 0, 0]
  Vec3.add(result, Vec3.scale(Vec3.copy(TangentX), H[0]))
  Vec3.add(result, Vec3.scale(Vec3.copy(TangentY), H[1]))
  Vec3.add(result, Vec3.scale(Vec3.copy(N), H[2]))
  return result
}

// glsl atan = JS Math.atan2
function envMapEquirect (wcNormal, flipEnvMap) {
  flipEnvMap = flipEnvMap || 1
  // I assume envMap texture has been flipped the WebGL way (pixel 0,0 is a the bottom)
  // therefore we flip wcNorma.y as acos(1) = 0
  var phi = Math.acos(-wcNormal[1])
  var theta = Math.atan2(flipEnvMap * wcNormal[0], wcNormal[2]) + Math.PI
  // console.log('theta', theta, 'phi', phi, 'x', wcNormal[0], 'y', wcNormal[1], 'z', wcNormal[2])
  return [theta / (2 * Math.PI), phi / Math.PI]
}

// this works but why?
// why i need to flip z?
function envMapEquirectInv (texCoord) {
  var theta = 2 * Math.PI * texCoord[0] + Math.PI * 0.5
  var phi = Math.PI * texCoord[1]

  var x = Math.cos(theta) * Math.sin(phi)
  var y = -Math.cos(phi)
  var z = -Math.sin(theta) * Math.sin(phi)

  return round([x, y, z])
}

function convoluteEnvmap (data, w, h) {
  var nw = 128
  var nh = 64
  var ndata = []

  for (var ny = 0; ny < nh; ny++) {
    for (var nx = 0; nx < nw; nx++) {
      // var x = (nx * w / nw) | 0
      // var y = (ny * h / nh) | 0
      // var r = data[(x + y * w) * 4]
      // var g = data[(x + y * w) * 4 + 1]
      // var b = data[(x + y * w) * 4 + 2]
      // var a = data[(x + y * w) * 4 + 3]

      var u = nx / nw
      var v = ny / nh

      var dir = envMapEquirectInv([u, v])
      var numSamples = 64//512 * 2

      var colorSum = [0, 0, 0, 0]
      var weightSum = 0
      for (var sampleI = 0; sampleI < numSamples; sampleI++) {
        // direction from x,y aka u, v
        // var sampleDir = Vec3.normalize(random.vec3())
        var sampleDir = hemisphereSample([random.float(), random.float()], dir)
        var weight = Math.max(0, Vec3.dot(dir, sampleDir))

        if (weight > 0) {
          var sampleUV = envMapEquirect(sampleDir)
          var su = sampleUV[0]
          var sv = sampleUV[1]
          var sx = su * w | 0
          var sy = sv * h | 0
          var idx = (sx + sy * w) * 4
          var sr = data[idx]
          var sg = data[idx + 1]
          var sb = data[idx + 2]
          colorSum[0] += weight * sr
          colorSum[1] += weight * sg
          colorSum[2] += weight * sb
          weightSum += weight
        }
      }

      ndata.push(colorSum[0] / weightSum, colorSum[1] / weightSum, colorSum[2] / weightSum, 1)
    }
  }
  return {
    shape: [nw, nh],
    data: new Float32Array(ndata)
  }
}

function init (win) {
  var res = win.getResources()
  var ctx = win.getContext()
  var W = win.getWidth()
  var H = win.getHeight()

  var hdrInfo = parseHdr(res.img)

  State.envmap = ctx.createTexture2D(hdrInfo.data, hdrInfo.shape[0], hdrInfo.shape[1], { type: ctx.FLOAT, flipEnvMap: true })
  State.cubemap = ctx.createTextureCube(null, 512, 512, { type: ctx.FLOAT, flipEnvMap: true })
  State.cubemapConv = ctx.createTextureCube(null, 64, 64, { type: ctx.FLOAT, flipEnvMap: true })

  State.envmap = ctx.createTexture2D(hdrInfo.data, hdrInfo.shape[0], hdrInfo.shape[1], { type: ctx.FLOAT, flipEnvMap: true })
  var envmapConv = convoluteEnvmap(hdrInfo.data, hdrInfo.shape[0], hdrInfo.shape[1])
  State.envmapConv = ctx.createTexture2D(envmapConv.data, envmapConv.shape[0], envmapConv.shape[1], { type: ctx.FLOAT, flipEnvMap: true })

  envmapToCubemap(ctx, State.envmap, State.cubemap)
  convolveCubemap(ctx, State.cubemap, State.cubemapConv)

  var scale = 1
  State.gui = new GUI(ctx, W, H, scale)

  State.gui.addTextureCube('Cubemap', State.cubemap, { hdr: true }).setPosition(180 * scale, 10 * scale)
  State.gui.addTextureCube('Cubemap Conv', State.cubemapConv, { hdr: true })
  State.gui.addTexture2D('Envmap', State.envmap, { hdr: true,  flipEnvMap: -1 })
  State.gui.addTexture2D('Envmap Conv', State.envmapConv, { hdr: true, flipEnvMap: -1 })

  State.pointSpriteProgram = ctx.createProgram(PointSpriteSolidColor.Vert, PointSpriteSolidColor.Frag)
  State.pointSpriteProgram = ctx.createProgram(PointSpriteShowColors.Vert, PointSpriteShowColors.Frag)

  var points = []
  var colors = []
  for (var i = 0; i < 10000; i++) {
    var p1 = round(Vec3.normalize(random.vec3()))
    var uv = envMapEquirect(p1, 1)
    var p2 = envMapEquirectInv(uv)
    points.push([p2[0], p2[1], p2[2]])
    colors.push([uv[0], uv[1], 0, 1])
  }
  State.pointsMesh = ctx.createMesh([
    { data: points, location: ctx.ATTRIB_POSITION },
    { data: colors, location: ctx.ATTRIB_COLOR }
    ], null, ctx.POINTS
  )

  State.camera = new PerspCamera(60, win.getAspectRatio(), 0.1, 100)
  State.camera.lookAt([0, 1, 3], [0, 0, 0])
  State.arcball = new Arcball(State.camera, win.getWidth(), win.getHeight())
  win.addEventListener(State.arcball)
}

function draw (win) {
  var ctx = win.getContext()

  ctx.setClearColor(0.2, 0.2, 0.2, 1)
  ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT)
  ctx.setDepthTest(true)

  State.arcball.apply()
  ctx.setProjectionMatrix(State.camera.getProjectionMatrix())
  ctx.setViewMatrix(State.camera.getViewMatrix())

  ctx.bindProgram(State.pointSpriteProgram)
  State.pointSpriteProgram.setUniform('uPointSize', 5)
  ctx.bindMesh(State.pointsMesh)
  ctx.drawMesh()

  State.gui.draw()
}

Window.create({
  settings: Settings,
  resources: Resources,
  init: function () { init(this) },
  draw: function () { draw(this) }
})
