'use strict'
require('debug').enable('*')
const log = require('debug')('app')
const gl = require('pex-gl')(1280, 720, 1)
const regl = require('regl')(gl)
// const R = require('ramda')
const load = require('pex-io/load')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const d3geo = require('d3-geo')
const drawSolidColor = require('./lib/draw-solid-color')(regl)
const drawBuilding = require('./lib/draw-building')(regl)
const extrudePolygon = require('./local_modules/extrude-polygon')
const merge = require('./local_modules/geom-merge')

const camera = createCamera({
  fov: Math.PI / 3,
  aspect: gl.canvas.width / gl.canvas.height,
  near: 0.01,
  far: 100,
  position: [2, 2, 2],
  target: [0, 0, 0],
  up: [0, 1, 0]
})

createOrbiter({
  camera: camera
})

load({
  // map: { json: 'map.geojson' }
  // map: { json: 'somerset.geojson' }
  map: { json: 'twickenham.geojson' }
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
        height /= 500
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
  // there is some outlier in twickenham so i hardcoded the position
  center = [ -0.3291374193783555, 51.44773271153468 ]
  var scale = 0.1
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
  // polygonsCombined.positions = regl.buffer(polygonsCombined.positions)
  // polygonsCombined.normals = regl.buffer(polygonsCombined.normals)

  console.log('about to draw', 'points', points.length, lines3.length, polygons3.length, 'poly verts', polygonsCombined.positions.length)

  regl.frame(() => {
    regl.clear({
      color: [0.2, 0.2, 0.2, 1],
      depth: 1
    })
    drawSolidColor({ points: points3, color: [1, 1, 0, 1], primitive: 'points', camera: camera })
    // lines3.forEach((line) => drawSolidColor({ points: line, color: [1, 0.5, 0, 1], primitive: 'line strip', camera: camera }))
    drawSolidColor({ points: linesCombined, color: [1, 0.5, 0, 1], primitive: 'lines', camera: camera })
    // polygons3.forEach((polygon) => drawBuilding({ geom: polygon, color: [0, 1, 0.5, 1], primitive: 'triangles', camera: camera }))
    drawBuilding({ geom: polygonsCombined, color: [0, 1, 0.5, 1], primitive: 'triangles', camera: camera })
  })
})
