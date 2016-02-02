var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var random          = require('pex-random')
var fx              = require('pex-fx')

var MAX_DEPTH = 10

function divide(parent, rects) {
    rects.push(parent);

    var depth = parent[4]

    var shouldDivide = random.chance(1/(depth+1));
    if (depth <= 1) {
        shouldDivide = true
    }

    if (depth >= MAX_DEPTH || !shouldDivide) {
        return rects
    }

    var numDivisions = random.int(2, 5)
    var horizontal = random.chance(0.5);
    if (depth == 0) horizontal = false;
    if (depth == 1) horizontal = true;

    for(var i=0; i<numDivisions; i++) {
        var child = null
        if (horizontal) {
            child = [
                parent[0] + parent[2] * i * 1 / numDivisions,
                parent[1],
                parent[2] * 1 / numDivisions,
                parent[3],
                depth + 1
            ]
        }
        else {
            child = [
                parent[0],
                parent[1] + parent[3] * i * 1 / numDivisions,
                parent[2],
                parent[3] * 1 / numDivisions,
                depth + 1
            ]
        }
        divide(child, rects)
    }
    return rects
}

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
        solidColorVert: { glsl: glslify(__dirname + '/assets/SolidColor.vert') },
        solidColorFrag: { glsl: glslify(__dirname + '/assets/SolidColor.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();


        this.rects = divide([-1, -0.5, 2, 1, 0], [])


        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.solidColorProgram = ctx.createProgram(res.solidColorVert, res.solidColorFrag);
        ctx.bindProgram(this.solidColorProgram);

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        var cubeWireIndices = { data: cube.cells };
        this.cubeWireMesh = ctx.createMesh(cubeAttributes, cubeWireIndices, ctx.LINES);
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(1, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        var levelHeight = 0.04;
        ctx.bindProgram(this.solidColorProgram);
        ctx.setLineWidth(2)
        this.rects.forEach(function(rect) {
            ctx.pushModelMatrix()
            ctx.translate([rect[0] + rect[2]/2, levelHeight*(1+rect[4])/2, rect[1] + rect[3]/2])
            ctx.scale([rect[2], levelHeight*(1+rect[4]), rect[3]])
            this.solidColorProgram.setUniform('uColor', [1,1,1,1])
            ctx.bindMesh(this.cubeMesh);
            ctx.drawMesh();
            this.solidColorProgram.setUniform('uColor', [0.2,0.2,0.2,1])
            ctx.bindMesh(this.cubeWireMesh);
            ctx.drawMesh();
            ctx.popModelMatrix()
        }.bind(this))

    }
})
