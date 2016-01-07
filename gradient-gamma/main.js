var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var GUI             = require('pex-gui');
var Color           = require('pex-color');

var createGradient  = require('./create-gradient');

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : false
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
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

        var colors1 = ['#FF0000', '#00FF00', '#0000FF'].map(Color.fromHex);
        this.gui.addTexture2D('Gradient', ctx.createTexture2D(createGradient(colors1, 256, 64)));
        this.gui.addTexture2D('Gradient correct gamma', ctx.createTexture2D(createGradient(colors1, 256, 64, true)));

        var colors2 = ['#3031FF', '#AC38FE', '#F9252B', '#FEF63D'].map(Color.fromHex);
        this.gui.addTexture2D('Gradient', ctx.createTexture2D(createGradient(colors2, 256, 64)));
        this.gui.addTexture2D('Gradient correct gamma', ctx.createTexture2D(createGradient(colors2, 256, 64, true)));

        var colors3 = ['#32BB67', '#FDD542', '#FE2F39'].map(Color.fromHex);
        this.gui.addTexture2D('Gradient', ctx.createTexture2D(createGradient(colors3, 256, 64)));
        this.gui.addTexture2D('Gradient correct gamma', ctx.createTexture2D(createGradient(colors3, 256, 64, true)));
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.showNormalsProgram);
        ctx.bindMesh(this.cubeMesh);
        ctx.drawMesh();

        this.gui.draw();
    }
})
