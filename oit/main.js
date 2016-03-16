var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var createPlane     = require('primitive-plane');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var teapot          = require('teapot');
var vertexNormals   = require('normals').vertexNormals;
var normals         = require('angle-normals'); //https://www.npmjs.com/package/angle-normals
var rescaleVertices = require('rescale-vertices');
var AABB            = require('pex-geom/AABB');
var Vec3            = require('pex-math/Vec3');
var computeSmoothNormals = require('./local_modules/geom-compute-smooth-normals')

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(6.0);
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        var teapotBBox = AABB.fromPoints(teapot.positions)
        var size = AABB.size(teapotBBox);
        var maxSize = Math.max(size[0], Math.max(size[1], size[2]));
        Vec3.scale(teapotBBox[0], 1/maxSize)
        Vec3.scale(teapotBBox[1], 1/maxSize)

        this.teapotMesh = ctx.createMesh([
            { data: rescaleVertices(teapot.positions, teapotBBox), location: ctx.ATTRIB_POSITION },
            { data: computeSmoothNormals(teapot.positions, teapot.cells), location: ctx.ATTRIB_NORMAL }
        ], { data: teapot.cells }, ctx.TRIANGLES);

        var plane = createPlane(0.8, 3)
        this.planeMesh = ctx.createMesh([
            { data: plane.positions, location: ctx.ATTRIB_POSITION },
            { data: plane.normals, location: ctx.ATTRIB_NORMAL }
        ], { data: plane.cells }, ctx.TRIANGLES);
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.showNormalsProgram);

        for(var i=0; i<5; i++) {
            ctx.pushModelMatrix();
                ctx.translate([i*1.5-3, 0, 0])
                ctx.bindMesh(this.cubeMesh);
                ctx.drawMesh();
                ctx.pushModelMatrix();
                    ctx.translate([0,0.75, 0])
                    ctx.rotate(Math.PI, [0, 1, 0])
                    ctx.bindMesh(this.teapotMesh);
                    ctx.drawMesh();
                ctx.popModelMatrix();
                ctx.pushModelMatrix();
                    ctx.translate([0,0, 0.51])
                    ctx.bindMesh(this.planeMesh);
                    ctx.drawMesh();
                ctx.popModelMatrix();
            ctx.popModelMatrix();
        }
    }
})
