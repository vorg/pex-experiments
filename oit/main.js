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
var Mat4            = require('pex-math/Mat4');
var computeSmoothNormals = require('./local_modules/geom-compute-smooth-normals');
var createFx        = require('pex-fx');
var GUI             = require('pex-gui');

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

        var w = this.getWidth();
        var h = this.getHeight();

        var gui = this.gui = new GUI(ctx, w, h);
        this.addEventListener(this.gui);

        var highPrecision = false;
        var screenColorBuf = this.screenColorBuf = ctx.createTexture2D(null, w, h, { format: ctx.RGBA, type: highPrecision ? ctx.FLOAT : ctx.HALF_FLOAT });
        var screenNormalBuf = this.screenNormalBuf = ctx.createTexture2D(null, w, h, { format: ctx.RGBA, type: highPrecision ? ctx.FLOAT : ctx.UNSIGNED_BYTE }); //RG32F
        var screenDepthBuf = this.screenDepthBuf = ctx.createTexture2D(null, w, h, { magFilter: ctx.NEAREST, minFilter: ctx.NEAREST, format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        var screenFbo = this.screenFbo = ctx.createFramebuffer([
            { texture: screenColorBuf },
            { texture: screenNormalBuf }
        ], { texture: screenDepthBuf })

        this.camera  = new PerspCamera(45,this.getAspectRatio(), 1, 20.0);
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

        this.entities = [];
        for(var i=0; i<5; i++) {
            var cubePosition = [i*1.5-3, 0, 0]
            var cubeTransform = Mat4.createFromTranslation(cubePosition);
            this.entities.push({
                opacity: 1,
                mesh: this.cubeMesh,
                transform: cubeTransform
            })

            var teapotTransform = Mat4.createFromTranslation(cubePosition);
            Mat4.translate(teapotTransform, [0,0.75, 0])
            Mat4.rotate(teapotTransform,  Math.PI, [0, 1, 0])
            this.entities.push({
                opacity: 1,
                mesh: this.teapotMesh,
                transform: teapotTransform
            })

            var planeTransform = Mat4.createFromTranslation(cubePosition);
            Mat4.translate(planeTransform, [0, 0, 0.51])
            this.entities.push({
                opacity: 0.5,
                mesh: this.planeMesh,
                transform: planeTransform
            })
        }

        this.fx = createFx(ctx);

        this.gui.addTexture2D('Screen color', screenColorBuf);
        this.gui.addTexture2D('Screen normal', screenNormalBuf);
        this.gui.addTexture2D('Screen depth', screenDepthBuf);

    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.showNormalsProgram);

        var opaqueEntities = this.entities.filter(function(e) { return e.opacity == 1; })
        var transparentEntities = this.entities.filter(function(e) { return e.opacity < 1; })

        ctx.pushState(ctx.FRAMEBUFFER_BIT);
        ctx.bindFramebuffer(this.screenFbo);

        ctx.setClearColor(0, 0, 0, 0)
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT)

        opaqueEntities.forEach(function(entity) {
            ctx.pushModelMatrix();
                ctx.setModelMatrix(entity.transform)
                ctx.bindMesh(entity.mesh);
                ctx.drawMesh();
            ctx.pushModelMatrix();
        })

        transparentEntities.forEach(function(entity) {
            ctx.pushModelMatrix();
                ctx.setModelMatrix(entity.transform)
                ctx.bindMesh(entity.mesh);
                ctx.drawMesh();
            ctx.pushModelMatrix();
        })

        ctx.popState(ctx.FRAMEBUFFER_BIT);

        var root = this.fx.reset();
        root.image(this.screenColorBuf).blit({ width: this.getWidth(), height: this.getHeight() })

        this.gui.draw();
    }
})
