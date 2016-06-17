var Window = require('pex-sys/Window')
var PerspCamera = require('pex-cam/PerspCamera')
var Arcball = require('pex-cam/Arcball')
var ShowColors = require('pex-materials/show-colors')
var Vec3 = require('pex-math/Vec3')
var computeNormals = require('normals').vertexNormals

function factorial (n) {
  var result = 1
  for (var i = 2; i <= n; i++) {
    result *= i
  }
  return result
}

function K (l, m) {
  return Math.sqrt(
    (2 * l + 1) / (4 * Math.PI) *
    factorial(l - Math.abs(m)) / factorial(l + Math.abs(m))
  )
}

// evaluate an Associated Legendre Polynomial P(l,m,x) at x
function P (l, m, x) {
  var pmm = 1.0
  if (m > 0) {
    var somx2 = Math.sqrt((1.0 - x) * (1.0 + x))
    var fact = 1.0
    for (var i = 1; i <= m; i++) {
      pmm *= (-fact) * somx2
      fact += 2.0
    }
  }
  if (l === m) {
    return pmm
  }
  var pmmp1 = x * (2.0 * m + 1.0) * pmm
  if (l === m + 1) {
    return pmmp1
  }

  var pll = 0.0
  for (var ll = m + 2; ll <= l; ++ll) {
    pll = ((2.0 * ll - 1.0) * x * pmmp1 - (ll + m - 1.0) * pmm) / (ll - m)
    pmm = pmmp1
    pmmp1 = pll
  }

  return pll
}

function SH (l, m, theta, phi) {
  if (m > 0) {
    return Math.sqrt(2) * K(l, m) * Math.cos(m * phi) * P(l, m, Math.cos(theta))
  } else if (m < 0) {
    return Math.sqrt(2) * K(l, m) * Math.sin(-m * phi) * P(l, -m, Math.cos(theta))
  } else if (m === 0) {
    return K(l, 0) * P(l, m, Math.cos(theta))
  }
}

Window.create({
  settings: {
    width: 1280,
    height: 720,
    debug: true
  },
  init: function () {
    var ctx = this.getContext()

    this.camera = new PerspCamera(45, this.getAspectRatio(), 0.001, 20.0)
    this.camera.lookAt([0, 1, 3], [0, 0, 0])
    ctx.setProjectionMatrix(this.camera.getProjectionMatrix())

    this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight())
    this.arcball.setDistance(3.0)
    this.addEventListener(this.arcball)

    this.showColorsProgram = ctx.createProgram(ShowColors.Vert, ShowColors.Frag)
    ctx.bindProgram(this.showColorsProgram)

    var positions = []
    var colors = []
    var normals = []
    var texCoords = []
    var cells = []

    var thetaN = 16 * 2
    var phiN = 32 * 2
    for (var thetaI = 0; thetaI < thetaN + 1; thetaI++) {
      for (var phiI = 0; phiI < phiN + 1; phiI++) {
        var s = thetaI / thetaN
        var t = phiI / phiN
        var theta = s * Math.PI
        var phi = t * 2 * Math.PI
        var x = Math.sin(theta) * Math.cos(phi)
        var y = Math.sin(theta) * Math.sin(phi)
        var z = Math.cos(theta)
        var c = SH(3, -2, theta, phi)
        var scale = Math.abs(c)

        positions.push([x * scale, y * scale, z * scale])

        if (c > 0) {
          colors.push([0, c, 0, 1])
        } else {
          colors.push([-c, 0, 0, 1])
        }

        texCoords.push([s, t])
        normals.push([x, y, z])

        if (thetaI < thetaN && phiI < phiN) {
          cells.push([
            thetaI * (phiN + 1) + phiI,
            (thetaI + 1) * (phiN + 1) + phiI,
            (thetaI + 1) * (phiN + 1) + phiI + 1
          ])
          cells.push([
            thetaI * (phiN + 1) + phiI,
            (thetaI + 1) * (phiN + 1) + phiI + 1,
            thetaI * (phiN + 1) + phiI + 1
          ])
        }
      }
    }

    normals = computeNormals(cells, positions)
    for (var n = 0; n < positions.length; n++) {
      var L = Vec3.normalize([1, 1, 1])
      var N = normals[n]
      var NdotL = Math.max(0, Vec3.dot(N, L))
      NdotL = Math.pow(NdotL, 32)
      Vec3.add(colors[n], Vec3.scale([0.2, 0.2, 0.2], NdotL))
    }

    var attributes = [
      { data: positions, location: ctx.ATTRIB_POSITION },
      { data: normals, location: ctx.ATTRIB_NORMAL },
      { data: colors, location: ctx.ATTRIB_COLOR },
      { data: texCoords, location: ctx.ATTRIB_TEX_COORD_0 }
    ]
    this.mesh = ctx.createMesh(attributes, { data: cells }, ctx.TRIANGLES)
  },
  draw: function () {
    var ctx = this.getContext()

    this.arcball.apply()
    ctx.setViewMatrix(this.camera.getViewMatrix())

    ctx.setClearColor(0.2, 0.2, 0.2, 1)
    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT)
    ctx.setDepthTest(true)

    ctx.bindProgram(this.showColorsProgram)
    ctx.bindMesh(this.mesh)
    ctx.drawMesh()
  }
})
