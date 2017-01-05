/**
 * Merges list of geometries (simplicial complex) into one geometry.
 * @param  {Array of Geometry} geometries - list of geometries to be merged
 * @return {Geometry} - merged geometry with positions, cells and optionally uvs and normals (autodetected base on the first geometry in the list)
 */
function merge(geometries) {
    var result = {
        positions: [],
        cells: []
    };


    var hasNormals = geometries[0].normals !== undefined;
    var hasUVs = geometries[0].uvs !== undefined;

    var totalVerts = 0
    for(var idx=0, numGeometries=geometries.length; idx<numGeometries; idx++) {
      var g = geometries[idx];
      totalVerts += g.positions.length
    }

  result.positions.length = totalVerts

    if (hasNormals) {
        result.normals = [];
        result.normals.length = totalVerts
    }

    if (hasUVs) {
        result.uvs = [];
        result.uvs.length = totalVerts
    }

    var vertexOffset = 0;
    for(var idx=0, numGeometries=geometries.length; idx<numGeometries; idx++) {
        var g = geometries[idx];
        for (var j = 0; j < g.positions.length; j++) {
          result.positions[vertexOffset + j] = g.positions[j]
          if (hasNormals) {
            result.normals[vertexOffset + j] = g.normals[j];
          }
          if (hasUVs) {
            result.uvs[vertexOffset + j] = g.uvs[j];
          }
        }
        for(var faceIndex=0, numFaces=g.cells.length; faceIndex<numFaces; faceIndex++) {
            var face = g.cells[faceIndex];
            var newFace = [];
            for(var i=0, numVertices=face.length; i<numVertices; i++) {
                newFace.push(face[i] + vertexOffset);
            }
            result.cells.push(newFace);
        }
        vertexOffset += g.positions.length;
    }

    return result;
}

module.exports = merge;
