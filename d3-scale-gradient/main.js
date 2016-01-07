var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var bunny           = require('bunny');
var vertexNormals   = require('normals').vertexNormals;
var rescaleVertices = require('rescale-vertices');
var vec3            = require('pex-math/Vec3');
var d3_scale        = require('d3-scale');
var color           = require('pex-color');

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
        showColorsVert: { glsl: glslify(__dirname + '/assets/ShowColors.vert') },
        showColorsFrag: { glsl: glslify(__dirname + '/assets/ShowColors.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.showColorsProgram = ctx.createProgram(res.showColorsVert, res.showColorsFrag);
        ctx.bindProgram(this.showColorsProgram);

        var unitBox = [[-0.5,-0.5,-0.5], [0.5,0.5,0.5]];

        var normals = vertexNormals(bunny.cells, bunny.positions);
        var lightPos = vec3.normalize([1,1,1]);
        var diffuse = normals.map(function(n) {
            var d = vec3.dot(lightPos, n);
            d = (d + 1)/(1 + 1);
            return d;
        });

        var colorScale = d3_scale.viridis();
        //var colorScale = d3_scale.inferno();
        //var colorScale = d3_scale.cool();
        //var colorScale = d3_scale.magma();

        var colors = diffuse.map(colorScale).map(color.fromHex);

        var cubeAttributes = [
            { data: rescaleVertices(bunny.positions, unitBox), location: ctx.ATTRIB_POSITION },
            { data: colors, location: ctx.ATTRIB_COLOR }
        ];
        var cubeIndices = { data: bunny.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(1, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.showColorsProgram);
        ctx.bindMesh(this.cubeMesh);
        ctx.drawMesh();
    }
})
