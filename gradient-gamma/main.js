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
        this.gui.addLabel('Bla')

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

        var colors = ['#FF0000', '#00FF00', '#0000FF'].map(Color.fromHex);
        var colors = ['#3031FF', '#AC38FE', '#F9252B', '#FEF63D'].map(Color.fromHex);

        var gradientTex = ctx.createTexture2D(createGradient(colors, 256, 64));
        this.gui.addTexture2D('Gradient', gradientTex);
        var gradientTexGamma = ctx.createTexture2D(createGradient(colors, 256, 64, true));
        this.gui.addTexture2D('Gradient correct gamma', gradientTexGamma);
        this.gui.addLabel('END');
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
