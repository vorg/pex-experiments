'use strict'
require('debug').enable('*')
const log = require('debug')('app')
const gl = require('pex-gl')(1280, 720, 1)
const regl = require('regl')(gl)
const Mat4 = require('pex-math/Mat4')
const glsl = require('glslify')
// const R = require('ramda')
const load = require('pex-io/load')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const d3geo = require('d3-geo')

const camera = createCamera({
  fov: Math.PI / 3,
  aspect: gl.canvas.width / gl.canvas.height,
  near: 0.01,
  far: 10,
  position: [2, 2, 2],
  target: [0, 0, 0],
  up: [0, 1, 0]
})

createOrbiter({
  camera: camera
})

const drawCube = regl({
  attributes: {
    // aPosition: cube.positions,
    // aNormal: cube.normals
  },
  // elements: cube.cells,
  vert: glsl`
    #ifdef GL_ES
    #pragma glslify: transpose = require(glsl-transpose)
    #endif
    #pragma glslify: inverse = require(glsl-inverse)

    attribute vec3 aPosition;
    attribute vec3 aNormal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    varying vec3 vNormal;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      mat3 normalMatrix = mat3(transpose(inverse(modelViewMatrix)));
      vNormal = normalMatrix * aNormal;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
    }
  `,
  frag: `
    #ifdef GL_ES
    precision highp float;
    #endif

    varying vec3 vNormal;

    void main () {
      gl_FragColor.rgb = vNormal * 0.5 + 0.5;
      gl_FragColor.a = 1.0;
    }
  `,
  uniforms: {
    uProjectionMatrix: () => camera.projectionMatrix,
    uViewMatrix: () => camera.viewMatrix,
    uModelMatrix: Mat4.create()
  }
})

const drawPoints = regl({
  attributes: {
    aPosition: (_, props) => props.points
  },
  count: (_, props) => props.points.length,
  vert: glsl`
    attribute vec3 aPosition;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
      gl_PointSize = 1.0;
    }
  `,
  frag: `
    #ifdef GL_ES
    precision highp float;
    #endif

    uniform vec4 uColor;

    void main () {
      gl_FragColor = uColor;
    }
  `,
  primitive: 'points',
  uniforms: {
    uColor: (_, props) => props.color,
    uProjectionMatrix: () => camera.projectionMatrix,
    uViewMatrix: () => camera.viewMatrix,
    uModelMatrix: Mat4.create()
  }
})

const drawLines = regl({
  attributes: {
    aPosition: (_, props) => props.points
  },
  count: (_, props) => props.points.length,
  vert: glsl`
    attribute vec3 aPosition;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
      gl_PointSize = 3.0;
    }
  `,
  frag: `
    #ifdef GL_ES
    precision highp float;
    #endif

    uniform vec4 uColor;

    void main () {
      gl_FragColor = uColor;
    }
  `,
  primitive: 'line strip',
  uniforms: {
    uColor: (_, props) => props.color,
    uProjectionMatrix: () => camera.projectionMatrix,
    uViewMatrix: () => camera.viewMatrix,
    uModelMatrix: Mat4.create()
  }
})

load({
  map: { json: 'map.geojson' }
}, (err, res) => {
  log('loaded', err ? err : '')
  const features = res.map.features
  const points = []
  const lines = []
  const polygons = []

  // get points for all geometries
  features.forEach((feature, i) => {
    const type = feature.geometry.type
    const coords = feature.geometry.coordinates
    switch (type) {
      case 'Point':
        points.push(coords)
        break
      case 'LineString':
        lines.push(coords)
        coords.forEach((point) => {
          points.push(point)
        })
        break
      case 'Polygon':
        let height = feature.properties.height || feature.properties.maxheight || '3'
        height = parseFloat(height)
        if (feature.properties['building:levels']) {
          height = parseFloat(feature.properties['building:levels']) * 3
        }
        height = 0
        coords.forEach((loop) => {
          loop.height = height
          polygons.push(loop)
          loop.forEach((point) => {
            points.push(point)
          })
        })
        break
      default:
        log('error', `Unknown geometry type ${type}`)
    }
  })

  try {
    // based on http://stackoverflow.com/questions/14492284/center-a-map-in-d3-given-a-geojson-object
    var center = d3geo.geoCentroid(res.map)
    var scale = 1
    var width = 5
    var height = 5
    var offset = [0, 0]
    var projection = d3geo.geoMercator().scale(scale).center(center).translate(offset)
    var path = d3geo.geoPath().projection(projection)
    var bounds = path.bounds(res.map)
    var hscale = scale * width / (bounds[1][0] - bounds[0][0])
    var vscale = scale * height / (bounds[1][1] - bounds[0][1])
    var scale = (hscale < vscale) ? hscale : vscale
    var offset = [
      -(bounds[0][0] + bounds[1][0]) / 2,
      -(bounds[0][1] + bounds[1][1]) / 2
    ]

    // new projection
    projection = d3geo.geoMercator().center(center).scale(scale).translate(offset)
  } catch (e) {
    console.log(e)
  }

  // move points to 3d
  const points3 = points.map(projection).map((p) => [p[0], 0, p[1]])
  const lines3 = lines.map((line) => line.map(projection).map((p) => [p[0], 0, p[1]]))
  const polygons3 = polygons.map((line) => line.map(projection).map((p) => [p[0], line.height / 100, p[1]]))

  regl.frame(() => {
    regl.clear({
      color: [0.2, 0.2, 0.2, 1],
      depth: 1
    })
    drawPoints({ points: points3, color: [1, 1, 0, 1] })
    lines3.forEach((line) => drawLines({ points: line, color: [1, 0.5, 0, 1] }))
    polygons3.forEach((line) => drawLines({ points: line, color: [0, 1, 0.5, 1] }))
  })
})
