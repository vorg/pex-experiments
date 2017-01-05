const earcut = require('earcut')
const R = require('ramda')
const computeNormals = require('../geom-compute-normals')
const toFlatGeometry = require('../geom-to-flat-geometry')

function extrudePolygon (polygon, height) {
  var data = earcut.flatten(polygon)
  var triangles = earcut(data.vertices, data.holes, data.dimensions)
  var positions = []
  for (var i = 0; i < data.vertices.length; i += 2) {
    positions.push([data.vertices[i], 0, data.vertices[i + 1]])
  }
  var numPoints = positions.length
  for (var i = 0; i < data.vertices.length; i += 2) {
    positions.push([data.vertices[i], height, data.vertices[i + 1]])
  }
  var tris = triangles.slice(0)
  var cells = []
  for (var i = 0; i < tris.length; i += 3) {
    cells.push([tris[i], tris[i + 1], tris[i + 2]])
    cells.push([tris[i + 2] + numPoints, tris[i + 1] + numPoints, tris[i] + numPoints]) // reverse order
  }
  var offset = 0
  polygon.forEach((loop) => {
    for (var i = 0; i < loop.length; i++) {
      cells.push([i + offset, (i + 1) % loop.length, (i + 1) % loop.length + numPoints])
      cells.push([i + offset, (i + 1) % loop.length + numPoints, i + offset + numPoints])
    }
    offset += loop.length
  })
  var geom = toFlatGeometry({
    positions: positions,
    cells: cells
  })
  geom.normals = computeNormals(geom.positions, geom.cells)
  return geom
}

module.exports = extrudePolygon
