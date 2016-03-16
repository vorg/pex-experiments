//similar packages
//https://github.com/hughsk/mesh-normals

var Vec3 = require('pex-math/Vec3');
var createSpatialIndex = require('../spatial-index');

//TODO: change param order to cells, positions?

//Compute smooth normals for the mesh
//All vertices will be uniquely indentified by position not their index,
//this will allow to compute smooth normals even across discontinuities.
function computeSmoothNormals(positions, cells, out) {
    var vertices = positions;
    var faces = cells;
    var normals = out || [];

    var ab = [0, 0, 0];
    var ac = [0, 0, 0];
    var n  = [0, 0, 0];

    var spatialIndex = createSpatialIndex(positions);
    var uniqueNormals = spatialIndex.getUniquePoints().map(Vec3.create);

    for(var fi=0, numFaces=faces.length; fi<numFaces; fi++) {
        var f = faces[fi];
        var a = vertices[f[0]];
        var b = vertices[f[1]];
        var c = vertices[f[2]];
        Vec3.normalize(Vec3.sub(Vec3.set(ab, b), a));
        Vec3.normalize(Vec3.sub(Vec3.set(ac, c), a));
        Vec3.normalize(Vec3.cross(Vec3.set(n, ab), ac));
        for(var i=0, len=f.length; i<len; i++) {
            var position = positions[f[i]];
            var uniqueIndex = spatialIndex.indexOf(position);
            Vec3.add(uniqueNormals[uniqueIndex], n);
        }
    }

    for(var i=0, len=uniqueNormals.length; i<len; i++) {
        Vec3.normalize(uniqueNormals[i])
    }

    for(var i=0, len=positions.length; i<len; i++) {
        var position = positions[i];
        var uniqueIndex = spatialIndex.indexOf(position);
        if (!normals[i]) {
            normals[i] = Vec3.create();
        }
        Vec3.set(normals[i], uniqueNormals[uniqueIndex]);
    }
    return normals;
}

module.exports = computeSmoothNormals;
