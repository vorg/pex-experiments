const regl = require('regl')({
  pixelRatio: 1,
  extensions: ['EXT_shader_texture_lod', 'angle_instanced_arrays']
})
const mat4 = require('pex-math/Mat4')
const vec3 = require('pex-math/Vec3')
const rnd = require('pex-random')
const sphere = require('primitive-sphere')()
const GUI = require('./local_modules/pex-gui')
const sc = require('./index')

// algorithm params
let State = {}
State.deadZone = 0.1
State.growthStep = 0.03
State.splitChance = 0.4
State.viewAngle = 30
State.branchAngle = 30
State.viewDistance = 0.5
State.growthDirection = [0, 1, 0]
State.growthBias = 0.5

const gui = new GUI(regl, window.innerWidth, window.innerHeight)
window.addEventListener('mousedown', (e) => {
  gui.onMouseDown(e)
})
gui.addHeader('params')
gui.addParam('growth step', State, 'growthStep', { min: 0.01, max: 0.1 })
gui.addParam('split chance', State, 'splitChance', { min: 0, max: 1 })
gui.addParam('view angle', State, 'viewAngle', { min: 0, max: 180 })
gui.addParam('branch angle', State, 'branchAngle', { min: 0, max: 180 })
gui.addParam('view distance', State, 'viewDistance', { min: 0, max: 1 })
gui.addParam('growth dir', State, 'growthDirection', { min: -1, max: 1})
gui.addParam('growth bias', State, 'growthBias', { min: 0, max: 1})
gui.addSeparator()
gui.addButton('restart', () => {
  iterate = sc({ buds: [[0, -1, 0]], hormones: hormones })
})
let jsonData = []
gui.addButton('save', () => {
  console.log(JSON.stringify(jsonData.reverse()))
})

// generate hormones
let hormonesNum = 200
let hormones = []
for (let i = 0; i < hormonesNum; i++) {
  var pos = vec3.add(rnd.vec3(1), [0, 0, 0])
  if (vec3.length(vec3.sub(pos, [0, 0, 0])) > 5) {
    i--
    continue
  }
  hormones.push(pos)
}

let iterate = sc({ buds: [[0, -1, 0]], hormones: hormones })

const camera = require('regl-camera')(regl, {
  center: [0, 0, 0],
  theta: Math.PI / 2,
  distance: 4
})

const drawSphere = regl({
  vert: `
  precision mediump float;
  // attribute vec3 position;
  attribute vec3 position, offset, scale;
  uniform mat4 projection, view, model;
  void main() {
    vec4 pos = vec4(position, 1);
    pos.xyz *= scale;
    pos.xyz += offset;
    gl_Position = projection * view * model * pos;
  }`,
  frag: `
  precision mediump float;
  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.0);
  }`,
  attributes: {
    position: sphere.positions,
    offset: {
      buffer: regl.prop('offset'),
      divisor: 1
    },
    scale: {
      buffer: regl.prop('scale'),
      divisor: 1
    }
  },
  elements: sphere.cells,
  instances: regl.prop('instances'),
  uniforms: {
    color: regl.prop('color'),
    model: regl.prop('model')
  }
})

const drawLine = regl({
  frag: `
  precision mediump float;
  uniform vec4 color;
  void main () {
    gl_FragColor = color;
  }`,
  vert: `
  precision mediump float;
  uniform mat4 projection, view;
  attribute vec3 position;
  void main () {
    gl_Position = projection * view * vec4(position, 1);
  }`,
  attributes: {
    position: regl.prop('pos')
  },
  uniforms: {
    color: [1, 0, 0, 1]
  },
  primitive: 'lines',
  count: 2
})

let offsetsBuff = regl.buffer({
  type: 'float',
  usage: 'dynamic'
})
let scalesBuff = regl.buffer({
  type: 'float',
  usage: 'dynamic'
})

let prevAlive = 0

regl.frame(() => {
  regl.clear({
    color: [1, 1, 1, 1],
    depth: 1
  })

  camera(() => {
    let iterObject = iterate({
      deadZone: 0.1,
      growthStep: State.growthStep,
      splitChance: State.splitChance,
      viewAngle: State.viewAngle,
      branchAngle: State.branchAngle,
      viewDistance: State.viewDistance,
      growthDirection: State.growthDirection,
      growthBias: State.growthBias
    })
    let hormones = iterObject.hormones
    let buds = iterObject.buds

    const budOffsets = []
    const budScales = []
    jsonData.length = 0

    let minArea = 0.0005
    for (let i = 0; i < buds.length; i++) {
      buds[i].area = minArea
    }

    buds.forEach((bud) => {
      if (bud.parent) bud.parent.hasChildren = true
    })

    buds.forEach(function (bud) {
      var parent = bud.parent
      if (bud.hasChildren) return
      while (parent) {
        parent.area = (parent.area || 0) + minArea
        parent = parent.parent
      }
    })

    for (let i = 0; i < hormones.length; i++) {
      var hormone = hormones[i]
      if (hormone.state === 0) {
        // alive hormone
        // let model = mat4.createFromTranslation(hormone.position)
        // mat4.scale(model, [0.05, 0.05, 0.05])
        // drawSphere({ color: [0, 0, 1], view: mat4.create(), model: model })
      } else if (hormone.state === 1) {
        // dead hormone
      }
    };

    let alive = 0

    for (let i = 0; i < buds.length; i++) {
      var bud = buds[i]
      if (bud.parent) {
        // drawLine({ pos: [bud.parent.position, bud.position] })
      }

      if (bud.state === 0) {
        alive++

        // alive
        // let model = mat4.createFromTranslation(bud.position)
        // mat4.scale(model, [0.05, 0.05, 0.05])
        // drawSphere({ color: [0, 1, 0], view: mat4.create(), model: model })
      }

      if (bud.state === 1) {
        // dead
        let radius = Math.sqrt(bud.area) / 10
        budOffsets.push(bud.position)
        budScales.push([radius, radius, radius])

        if (bud.parent) jsonData.push([bud.position, buds.indexOf(bud.parent)])
        else jsonData.push([bud.position, -1])
      }
    }

    // let offsetsBuff = regl.buffer(budOffsets)
    // let scalesBuff = regl.buffer(budScales)
    if (alive > 0 || alive !== prevAlive) {
      prevAlive = alive
      offsetsBuff(budOffsets)
      scalesBuff(budScales)
    }

    drawSphere({
      color: [0.4, 0.4, 0.4],
      view: mat4.create(),
      model: mat4.create(),
      instances: budOffsets.length,
      offset: offsetsBuff,
      scale: scalesBuff
    })

    gui.draw()
  })
})

