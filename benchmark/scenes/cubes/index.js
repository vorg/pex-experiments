var glslify     = require('glslify-sync');
var Mat4        = require('pex-math/Mat4');
var createCube  = require('primitive-cube');
var rnd         = require('pex-random');

var vert = glslify(__dirname + '/ShowNormals.vert');
var frag = glslify(__dirname + '/ShowNormals.frag');

function Cubes(width, height) {
    this.projectionMat = Mat4.perspective([], 60, width/height, 0.1, 100);
    this.viewMatrix = Mat4.lookAt([], [0,0,3], [0,0,0], [0,1,0]);
}

Cubes.prototype.init = function(ctx) {
    this.showNormalsProgram = ctx.createProgram(vert, frag);
    ctx.bindProgram(this.showNormalsProgram);

    var cube = createCube(0.25);
    var cubeAttributes = [
        { data: cube.positions, location: ctx.ATTRIB_POSITION },
        { data: cube.normals, location: ctx.ATTRIB_NORMAL }
    ];
    var cubeIndices = { data: cube.cells };
    this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);
}

Cubes.prototype.shutdown = function(ctx) {
    //this.cubeMesh
}

Cubes.prototype.draw = function(ctx, elapsedSeconds) {
    ctx.setClearColor(1.0, 0.2, 0.2, 1.0);

    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
    ctx.setDepthTest(true);


    ctx.setProjectionMatrix(this.projectionMat);

    ctx.bindProgram(this.showNormalsProgram);
    ctx.bindMesh(this.cubeMesh);

    rnd.seed(0);

    var scale = [1,1,1];

    var numCubes = 5000;

    for(var i=0; i<numCubes; i++) {
        ctx.pushModelMatrix();
        var offset = rnd.vec3(3);
        offset[2] *= 0.1;
        scale[0] = 0.5 + 0.4 * Math.sin(elapsedSeconds + i);
        scale[1] = 0.5 + 0.4 * Math.sin(elapsedSeconds + i);
        ctx.translate(offset);
        ctx.scale(scale)
        ctx.drawMesh();
        ctx.popModelMatrix();
    }


    ctx.setViewMatrix(this.viewMatrix);

    return numCubes;
}



module.exports = Cubes;
