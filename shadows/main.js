var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var bunny           = require('bunny');
var normals         = require('normals');
var rescaleVertices = require('rescale-vertices');
var Mat4            = require('pex-math/Mat4');
var GUI             = require('pex-gui');
var rnd             = require('pex-random');

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : false
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
        shadowMappedVert: { glsl: glslify(__dirname + '/assets/ShadowMapped.vert') },
        shadowMappedFrag: { glsl: glslify(__dirname + '/assets/ShadowMapped.frag') }
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.addEventListener(this.gui);

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([-2, 2, 5], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(7.0);
        this.addEventListener(this.arcball);

        this.initMeshes();
        this.initResources();
    },
    initMeshes: function() {
        var ctx = this.getContext();

        var targetBounds = [
            [-1, -1, -1],
            [ 1,  1,  1]
        ];

        var bunnyBaseVertices = rescaleVertices(bunny.positions, targetBounds);
        var bunnyBaseNormals = normals.vertexNormals(bunny.cells, bunny.positions);

        var bunnyAttributes = [
            { data: bunnyBaseVertices, location: ctx.ATTRIB_POSITION },
            { data: bunnyBaseNormals, location: ctx.ATTRIB_NORMAL }
        ];
        var bunnyIndices = { data: bunny.cells };
        this.bunnyMesh = ctx.createMesh(bunnyAttributes, bunnyIndices, ctx.TRIANGLES);

        var cube = createCube(15, 0.1, 15);
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.floorMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        var box = createCube();
        var boxAttributes = [
            { data: box.positions, location: ctx.ATTRIB_POSITION },
            { data: box.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var boxIndices = { data: box.cells };
        this.boxMesh = ctx.createMesh(boxAttributes, boxIndices, ctx.TRIANGLES);
        this.boxes = [];
        for(var i=0; i<50; i++) {
            var pos = rnd.vec3(2);
            pos[0] += 3;
            pos[1] += 1;
            this.boxes.push({
                position: pos,
                scale: rnd.vec3()
            })
        }
    },
    initResources: function() {
        var res = this.getResources();
        var ctx = this.getContext();

        this.target     = [2, 0, 0];
        this.up         = [0, 1, 0];
        this.lightPos   = [5, 7, 6];
        this.lightNear  = 1;
        this.lightFar   = 20;

        this.shadowMapSize = 1024;

        this.lightProjectionMatrix = Mat4.perspective([], 60, 1, this.lightNear, this.lightFar);
        this.lightViewMatrix       = Mat4.lookAt([], this.lightPos, this.target, this.up);


        this.colorMap = ctx.createTexture2D(null, this.shadowMapSize, this.shadowMapSize);
        this.depthMap = ctx.createTexture2D(null, this.shadowMapSize, this.shadowMapSize, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        this.shadowFBO = ctx.createFramebuffer([ { texture: this.colorMap }], { texture: this.depthMap });

        this.gui.addTexture2D('Color', this.colorMap);
        this.gui.addTexture2D('Depth', this.depthMap);

        this.blitProgram = ctx.createProgram(res.blitVert, res.blitFrag);

        this.blitTexture = this.depthMap;

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.drawDepthProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        this.drawShadowMappedProgram = ctx.createProgram(res.shadowMappedVert, res.shadowMappedFrag);

        ctx.bindProgram(this.drawShadowMappedProgram);

        this.drawShadowMappedProgram.setUniform('depthMap', this.depthMap)
        this.drawShadowMappedProgram.setUniform('ambientColor', [0.0, 0.0, 0.0, 0.0])
        this.drawShadowMappedProgram.setUniform('diffuseColor', [1.0, 1.0, 1.0, 1.0])
        this.drawShadowMappedProgram.setUniform('lightPos', this.lightPos)
        this.drawShadowMappedProgram.setUniform('wrap', 0)
        this.drawShadowMappedProgram.setUniform('lightNear', this.lightNear)
        this.drawShadowMappedProgram.setUniform('lightFar', this.lightFar)
        this.drawShadowMappedProgram.setUniform('lightViewMatrix', this.lightViewMatrix)
        this.drawShadowMappedProgram.setUniform('lightProjectionMatrix', this.lightProjectionMatrix)
    },
    drawScene: function() {
        var ctx = this.getContext();

        ctx.bindMesh(this.bunnyMesh);
        ctx.drawMesh();

        ctx.pushModelMatrix();
        ctx.bindMesh(this.floorMesh);
        ctx.translate([0, -1, 0])
        ctx.drawMesh();
        ctx.popModelMatrix();

        ctx.bindMesh(this.boxMesh);
        this.boxes.forEach(function(box) {
            ctx.pushModelMatrix();
            ctx.translate(box.position);
            ctx.scale(box.scale);
            ctx.drawMesh();
            ctx.popModelMatrix();
        })

    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();

        ctx.pushState(ctx.FRAMEBUFFER_BIT);
        ctx.bindFramebuffer(this.shadowFBO);
        ctx.bindProgram(this.showNormalsProgram);
        ctx.setViewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        ctx.setProjectionMatrix(this.lightProjectionMatrix);
        ctx.setViewMatrix(this.lightViewMatrix);
        ctx.setClearColor(1.0, 1.0, 1.0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        this.drawScene();

        ctx.popState(ctx.FRAMEBUFFER_BIT);
        ctx.setViewport(0, 0, this.getWidth(), this.getHeight());
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());
        ctx.setViewMatrix(this.camera.getViewMatrix());
        ctx.bindProgram(this.drawShadowMappedProgram);
        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);


        this.drawScene();

        this.gui.draw();
    }
})
