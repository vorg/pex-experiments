//Ported from https://github.com/glo-js/glo-demo-primitive

var Window      = require('pex-sys/Window');
var Mat4        = require('pex-math/Mat4');
var Vec3        = require('pex-math/Vec3');
var Quat        = require('pex-math/Quat');
var createCube  = require('primitive-cube');
var glslify     = require('glslify-promise');
var PerspCamera = require('pex-cam/PerspCamera');
var Arcball     = require('pex-cam/Arcball');
var random      = require('pex-random');
var MathUtils   = require('pex-math/Utils');
var GUI         = require('pex-gui');
var isBrowser   = require('is-browser');
var Color       = require('pex-color');

var remap       = MathUtils.map;
var fract       = function(f) { return f - Math.floor(f); }

Window.create({
    settings: {
        width: 1280,
        height: 720,
        type: '3d',
        fullScreen: isBrowser
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormalsInstanced.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormalsInstanced.frag') },
        shadowHardVert: { glsl: glslify(__dirname + '/assets/ShadowHardInstanced.vert') },
        shadowShadedFrag: { glsl: glslify(__dirname + '/assets/ShadowShaded.frag') }
    },
    init: function() {
        var ctx = this.getContext();

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.addEventListener(this.gui);

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.1, 20.0);
        this.camera.lookAt([2, 1, 2], [0, 0, 0]);

        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(5.0);
        this.addEventListener(this.arcball);

        var res = this.getResources();

        this.program = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.program);

        this.randomPositions = [];
        this.times = [];
        this.speeds = [];
        this.prevOffsets = [];
        this.offsets = [];
        this.scales = [];
        this.colors = [];

        for(var i=0; i<10; i++) {
            for(var j=0; j<1000; j++) {
                var t = (j % 100)/100;
                var pos = random.vec3(0.15);
                this.randomPositions.push(Vec3.copy(pos));
                pos[0] += remap(i, 0, 9, -2, 2);
                pos[0] += 0.1 * Math.sin(t * (1.0 + fract(1.1771 * i)) * Math.PI * 2 + i * 17.42)
                pos[1] += remap(t, 0, 1, -1, 1)
                this.offsets.push(pos)
                this.prevOffsets.push(Vec3.copy(pos));
                this.scales.push(0.1)
                this.times.push(t);
                this.speeds.push(0.1);
                var color = [1,1,1,1];
                if (random.chance(0.2)) {
                    color = Color.fromHSV(i/10,1,1);
                }
                this.colors.push(color)
            }
        }

        var box = createCube(0.25, 0.25, 0.5);
        var boxAttributes = [
            { data: box.positions, location: ctx.ATTRIB_POSITION },
            { data: box.normals, location: ctx.ATTRIB_NORMAL },
            { data: this.offsets, location: ctx.ATTRIB_CUSTOM_0, divisor: 1 },
            { data: this.prevOffsets, location: ctx.ATTRIB_CUSTOM_1, divisor: 1 },
            { data: this.scales, location: ctx.ATTRIB_CUSTOM_2, divisor: 1},
            { data: this.colors, location: ctx.ATTRIB_CUSTOM_3, divisor: 1}
        ];
        var boxIndices = { data: box.cells };
        this.boxMesh = ctx.createMesh(boxAttributes, boxIndices);

        var floor = createCube(3, 0.02, 3);
        var floorAttributes = [
            { data: floor.positions, location: ctx.ATTRIB_POSITION },
            { data: floor.normals, location: ctx.ATTRIB_NORMAL },
            { data: [[0,-1,0]], location: ctx.ATTRIB_CUSTOM_0, divisor: 1 },
            { data: [[0,-1,0]], location: ctx.ATTRIB_CUSTOM_1, divisor: 1 },
            { data: [2], location: ctx.ATTRIB_CUSTOM_2, divisor: 1},
            { data: [[1,1,1,1]], location: ctx.ATTRIB_CUSTOM_3, divisor: 1}
        ];
        var floorIndices = { data: floor.cells };
        this.floorMesh = ctx.createMesh(floorAttributes, floorIndices);

        var wall = createCube(3, 3, 0.02);
        var wallAttributes = [
            { data: wall.positions, location: ctx.ATTRIB_POSITION },
            { data: wall.normals, location: ctx.ATTRIB_NORMAL },
            { data: [[0,0,-0.5]], location: ctx.ATTRIB_CUSTOM_0, divisor: 1 },
            { data: [[0,0,-0.5]], location: ctx.ATTRIB_CUSTOM_1, divisor: 1 },
            { data: [2], location: ctx.ATTRIB_CUSTOM_2, divisor: 1},
            { data: [[1,1,1,1]], location: ctx.ATTRIB_CUSTOM_3, divisor: 1}
        ];
        var wallIndices = { data: wall.cells };
        this.wallMesh = ctx.createMesh(wallAttributes, wallIndices);

        this.initResources();
    },
    initResources: function() {
        var res = this.getResources();
        var ctx = this.getContext();

        this.target     = [0, 0, 0];
        this.up         = [0, 1, 0];
        this.lightPos   = [3, 3, 3];
        this.lightNear  = 3;
        this.lightFar   = 11;

        this.shadowMapSize = 1024;

        this.lightProjectionMatrix = Mat4.perspective([], 60, 1, this.lightNear, this.lightFar);
        this.lightViewMatrix       = Mat4.lookAt([], this.lightPos, this.target, this.up);

        this.colorMap = ctx.createTexture2D(null, this.shadowMapSize, this.shadowMapSize, { magFilter: ctx.NEAREST, minFilter: ctx.NEAREST, type: ctx.UNSIGNED_BYTE });
        this.depthMap = ctx.createTexture2D(null, this.shadowMapSize, this.shadowMapSize, { magFilter: ctx.NEAREST, minFilter: ctx.NEAREST, format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        this.shadowFBO = ctx.createFramebuffer([ { texture: this.colorMap }], { texture: this.depthMap });

        this.gui.addTexture2D('Color', this.colorMap);
        this.gui.addTexture2D('Depth', this.depthMap);

        this.blitProgram = ctx.createProgram(res.blitVert, res.blitFrag);

        this.blitTexture = this.depthMap;

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.showDepthProgram = ctx.createProgram(res.showDepthVert, res.showDepthFrag);
        ctx.bindProgram(this.showDepthProgram);

        this.drawDepthProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);

        this.shadowPrograms = [];
        this.shadowPrograms.push({ name: 'Shaded', program: ctx.createProgram(res.shadowHardVert, res.shadowShadedFrag) });
        this.activeShadowProgramIndex = 0;

        this.bias = 0.01;

        this.gui.addHeader('Program').setPosition(180, 10);
        this.gui.addParam('Light Y', this.lightPos, '1', { min: 3, max: 10 }, function() {
            this.lightViewMatrix       = Mat4.lookAt([], this.lightPos, this.target, this.up);
        }.bind(this));
        this.gui.addParam('Bias', this, 'bias', { min: 0, max: 1 });

        this.gui.addRadioList('Shadow program', this, 'activeShadowProgramIndex', this.shadowPrograms.map(function(programInfo, index) {
            return { name: programInfo.name, value: index}
        }));
    },
    drawScene: function() {
        var ctx = this.getContext();
        ctx.bindMesh(this.boxMesh);
        ctx.drawMesh(10000);

        ctx.bindMesh(this.wallMesh);
        //ctx.drawMesh(1);

        ctx.bindMesh(this.floorMesh);
        ctx.drawMesh(1);
    },
    update: function() {
        var idx = 0;
        var delta = this.getTime().getDeltaSeconds();
        for(var i=0; i<10; i++) {
            for(var j=0; j<1000; j++) {
                this.times[idx] += this.speeds[idx] * delta;
                var t = this.times[idx];
                Vec3.set(this.prevOffsets[idx], this.offsets[idx]);
                var pos = this.offsets[idx];
                Vec3.set(pos, this.randomPositions[idx]);
                pos[0] += remap(i, 0, 9, -2, 2);
                pos[0] += 0.2 * Math.sin(t * (1.0 + fract(1.1771 * i)) * Math.PI * 2 + i * 17.42)
                pos[2] += 0.2 * Math.cos(t * (1.0 + fract(1.1771 * i)) * Math.PI * 2 + i * 17.42)
                pos[2] += Math.cos(i);
                pos[1] += remap(t % 1, 0, 1, -1, 1)
                idx++;
            }
        }

        var ctx = this.getContext();
        this.boxMesh.updateAttribute(ctx.ATTRIB_CUSTOM_0, this.offsets);
        this.boxMesh.updateAttribute(ctx.ATTRIB_CUSTOM_1, this.prevOffsets);
    },
    draw: function() {
        var ctx = this.getContext();

        this.update();

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
        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        var activeShadowProgram = this.shadowPrograms[this.activeShadowProgramIndex].program;
        ctx.bindProgram(activeShadowProgram);

        ctx.bindTexture(this.depthMap, 0);
        activeShadowProgram.setUniform('depthMap', 0);
        activeShadowProgram.setUniform('ambientColor', [0.0, 0.0, 0.0, 0.0])
        activeShadowProgram.setUniform('diffuseColor', [1.0, 1.0, 1.0, 1.0])
        activeShadowProgram.setUniform('lightPos', this.lightPos)
        activeShadowProgram.setUniform('bias', this.bias)
        activeShadowProgram.setUniform('wrap', 1)
        activeShadowProgram.setUniform('lightNear', this.lightNear)
        activeShadowProgram.setUniform('lightFar', this.lightFar)
        activeShadowProgram.setUniform('lightViewMatrix', this.lightViewMatrix)
        activeShadowProgram.setUniform('lightProjectionMatrix', this.lightProjectionMatrix)
        if (activeShadowProgram.hasUniform('depthMapSize')) {
            activeShadowProgram.setUniform('depthMapSize', [this.shadowMapSize, this.shadowMapSize]);
        }

        this.drawScene();

        this.gui.draw();

    }
})
