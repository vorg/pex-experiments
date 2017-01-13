'use strict'
require('debug').enable('*')
const log = require('debug')('app')
const gl = require('pex-gl')(1280, 720, 2)
const regl = require('regl')(gl)
// const R = require('ramda')
const load = require('pex-io/load')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const d3geo = require('d3-geo')
const drawSolidColor = require('./lib/draw-solid-color')(regl)
const drawBuilding = require('./lib/draw-building')(regl)
const drawScattering = require('./lib/draw-scattering')(regl)
const extrudePolygon = require('./local_modules/extrude-polygon')
const merge = require('./local_modules/geom-merge')
const createSphere = require('primitive-sphere')
const toFlatGeometry = require('./local_modules/geom-to-flat-geometry')
const computeNormals = require('./local_modules/geom-compute-normals')
const GUI = require('./local_modules/pex-gui')
const Vec2 = require('pex-math/Vec2')

const gui = new GUI(regl, 1280, 720, 1)
gui.addHeader('settings')
gl.canvas.addEventListener('mousedown', (e) => {
  gui.onMouseDown(e)
})
gl.canvas.addEventListener('mousemove', (e) => {
  gui.onMouseDrag(e)
})
gl.canvas.addEventListener('mouseup', (e) => {
  gui.onMouseUp(e)
})


const sphere = toFlatGeometry(createSphere(10))
sphere.normals = computeNormals(sphere.positions, sphere.cells)

const camera = createCamera({
  fov: Math.PI / 3,
  aspect: gl.canvas.width / gl.canvas.height,
  near: 0.01,
  far: 100,
  position: [1, 1, 1],
  target: [0, 0, 0],
  up: [0, 1, 0]
})

createOrbiter({
  camera: camera
})

load({
  map: { json: 'map.geojson' }
}, (err, res) => {
  log('loaded', err ? err : '')
  const features = res.map.features
  const points = []
  const lines = []
  const polygons = []

  console.log(features.length)

  // get points for all geometries
  features.forEach((feature, i) => {
    const type = feature.geometry.type
    const coords = feature.geometry.coordinates
    switch (type) {
      case 'Point':
        // points.push(coords)
        break
      case 'LineString':
        if (feature.properties.height) console.log('line h', feature.properties)
        lines.push(coords)
        // coords.forEach((p) => points.push(p))
        break
      case 'Polygon':
        let height = feature.properties.height || feature.properties.maxheight || '0'
        height = parseFloat(height)
        if (feature.properties['building:levels']) {
          height = parseFloat(feature.properties['building:levels']) * 3
        }
        if (feature.properties.building) {
          height = Math.max(height, 1)
        }
        height /= 100
        coords.height = height
        polygons.push(coords)
        coords.forEach((loop) => loop.forEach((p) => points.push(p)))
        break
      default:
        log('error', `Unknown geometry type ${type}`)
    }
  })

  // based on http://stackoverflow.com/questions/14492284/center-a-map-in-d3-given-a-geojson-object
  var center = d3geo.geoCentroid(res.map)
  center = [0, 0]
  points.forEach((p) => {
    Vec2.add(center, p)
  })
  Vec2.scale(center, 1 / points.length)

  var scale = 0.1
  var width = 10
  var height = 10
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

  console.log('center', center)

  // new projection
  projection = d3geo.geoMercator().center(center).scale(scale).translate(offset)

  // move points to 3d
  const points3 = points
    .map(projection).map((p) => [p[0], 0, p[1]])

  const lines3 = lines
    .map((line) => line.map(projection).map((p) => [p[0], 0, p[1]]))

  const linesCombined = lines3.reduce((combined, line) => {
    line.forEach((p, i) => {
      if (i > 0) combined.push(line[i - 1], p)
    })
    return combined
  }, [])

  const polygons3 = polygons
    .map((loop) => loop.map((line) => line.map(projection)))
    .map((polygon, i) => extrudePolygon(polygon, polygons[i].height))

  console.time('merge')
  const polygonsCombined = merge(polygons3.slice(0, 10000))
  console.timeEnd('merge')
  polygonsCombined.cells = null

  console.log('about to draw', 'points', points.length, lines3.length, polygons3.length, 'poly verts', polygonsCombined.positions.length)

  var lights = [
    { position: [0, 0, 0], color: [0.2, 0.5, 0.8, 1] }
  ]

  gui.addParam('Light 0', lights[0], 'color', { type: 'color' })

  regl.frame(() => {
    regl.clear({
      color: [1.0, 0.0, 0.0, 1],
      depth: 1
    })

    lights.forEach((light) => {
      // streets
      drawScattering({
        geom: { positions: linesCombined },
        primitive: 'lines',
        camera: camera,
        lightPos: light.position,
        lightColor: light.color,
        ambientColor: [0.3 / 2, 0.7 / 2, 0.4 / 2, 1],
        albedoColor: [0.8, 0.3, 0.7, 1.0]
      })

      // buildings
      drawScattering({
        geom: polygonsCombined,
        primitive: 'triangles',
        camera: camera,
        lightPos: light.position,
        lightColor: light.color,
        ambientColor: [0, 0, 0, 1],
        albedoColor: [0.8, 0.3, 0.7, 1.0]
      })

      // background sky
      drawScattering({
        geom: sphere,
        primitive: 'triangles',
        camera: camera,
        lightPos: light.position,
        lightColor: light.color,
        ambientColor: [0, 0, 0, 1],
        albedoColor: [0.8, 0.3, 0.7, 1.0]
      })
    })

    gui.draw()
  })
})
