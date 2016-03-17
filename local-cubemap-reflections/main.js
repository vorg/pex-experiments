var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var Texture2D       = require('pex-context/Texture2D')
var TextureCube       = require('pex-context/TextureCube')
var renderToCubemap = require('./local_modules/render-to-cubemap');
var downsampleCubemap = require('./local_modules/downsample-cubemap');
var convolveCubemap = require('./local_modules/convolve-cubemap');
var createSphere    = require('primitive-sphere');
var GUI             = require('pex-gui');

var CUBEMAP_SIZE = 128; //->128 -> 64 -> 32 -> 16

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
        diffuseVert: { glsl: glslify(__dirname + '/assets/Diffuse.vert') },
        diffuseFrag: { glsl: glslify(__dirname + '/assets/Diffuse.frag') },
        reflectionVert: { glsl: glslify(__dirname + '/assets/Reflection.vert') },
        reflectionFrag: { glsl: glslify(__dirname + '/assets/Reflection.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 0, -5], [0, 0, -2]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.diffuseProgram = ctx.createProgram(res.diffuseVert, res.diffuseFrag);
        ctx.bindProgram(this.diffuseProgram);

        this.reflectionProgram = ctx.createProgram(res.reflectionVert, res.reflectionFrag);
        ctx.bindProgram(this.reflectionProgram);

        var entities = this.entities = [];

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        var cubeMesh = this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        var sphere = createSphere();
        var sphereAttributes = [
            { data: sphere.positions, location: ctx.ATTRIB_POSITION },
            { data: sphere.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var sphereIndices = { data: sphere.cells };
        var sphereMesh = this.sphereMesh = ctx.createMesh(sphereAttributes, sphereIndices, ctx.TRIANGLES);

        this.reflectionMap = ctx.createTextureCube(null, CUBEMAP_SIZE, CUBEMAP_SIZE, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST });
        this.reflectionMap64 = ctx.createTextureCube(null, CUBEMAP_SIZE/2, CUBEMAP_SIZE/2, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST });
        this.reflectionMap32 = ctx.createTextureCube(null, CUBEMAP_SIZE/4, CUBEMAP_SIZE/4, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST });
        this.reflectionMap16 = ctx.createTextureCube(null, CUBEMAP_SIZE/8, CUBEMAP_SIZE/8, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST });
        this.irradianceMap = ctx.createTextureCube(null, CUBEMAP_SIZE/8, CUBEMAP_SIZE/8);

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight())
        this.gui.addTextureCube('Reflection', this.reflectionMap)
        this.gui.addTextureCube('Reflection 64', this.reflectionMap64);
        this.gui.addTextureCube('Reflection 32', this.reflectionMap32);
        this.gui.addTextureCube('Reflection 16', this.reflectionMap16);
        this.gui.addTextureCube('IrradienceMap', this.irradianceMap);

        var s = 6;

        entities.push({ mesh: cubeMesh, position: [0,-1,0], scale: [s, 0.1, s], material: { program: this.reflectionProgram, uniforms: { uColor: [0.1,0.1,0.1,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 } }}) //floor
        entities.push({ mesh: cubeMesh, position: [0,1,0], scale: [s, 0.1, s], material: { program: this.reflectionProgram, uniforms: { uColor: [0.6,0.6,0.6,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 } }}) //ceeling
        entities.push({ mesh: cubeMesh, position: [-s/2, 0, 0], scale: [0.1, 2, s], material: { program: this.reflectionProgram, uniforms: { uColor: [1,0.3,0.3,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 } }}) //left
        entities.push({ mesh: cubeMesh, position: [s/2, 0, 0], scale: [0.1, 2, s], material: { program: this.reflectionProgram, uniforms: { uColor: [1,0.3,0.3,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 } }}) //right
        entities.push({ mesh: cubeMesh, position: [0, 0, s/2], scale: [s, 2, 0.1], material: { program: this.reflectionProgram, uniforms: { uColor: [0.2,0.2,0.42,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 } }}) //back

        //screens
        for(var i=-s/2+0.5; i<=s/2-0.5; i++) {
            entities.push({
                mesh: cubeMesh,
                position: [i, 0, s/2],
                scale: [0.6, 0.8, 0.2],
                material: {
                    program: this.reflectionProgram,
                    uniforms: { uColor: [1,1,1,1], uReflectionMap: this.reflectionMap, uReflectivity: 0 }
                }
            })
        }

        entities.push({
            finalOnly: true,
            mesh: sphereMesh,
            position: [0.5,0,0],
            scale: [0.25,0.25,0.25],
            material: {
                program: this.reflectionProgram,
                uniforms: {
                    uColor: [0,0,0,1],
                    uReflectionMap: this.reflectionMap,
                    uReflectivity: 1
                }
            }
        })

        entities.push({
            finalOnly: true,
            mesh: sphereMesh,
            position: [-0.5,0,0],
            scale: [0.25,0.25,0.25],
            material: {
                program: this.reflectionProgram,
                uniforms: {
                    uColor: [0,0,0,1],
                    uReflectionMap: this.irradianceMap,
                    uReflectivity: 1
                }
            }
        })

    },
    drawScene: function(final) {
        var ctx = this.getContext();

        ctx.pushState(ctx.MESH_BIT | ctx.PROGRAM_BIT);
        this.entities.forEach(function(entity) {
            if (entity.finalOnly && !final) {
                return;
            }
            if (!entity.finalOnly) {
                entity.material.uniforms.uReflectivity = final ? 0.3 : 0;
            }
            ctx.pushModelMatrix();
            ctx.translate(entity.position);
            ctx.scale(entity.scale);
            ctx.bindMesh(entity.mesh);
            var material = entity.material;
            ctx.bindProgram(material.program);
            var numTextures = 0;
            for(var uniformName in material.uniforms) {
                var value = material.uniforms[uniformName];
                if ((value instanceof Texture2D) || (value instanceof TextureCube)) {
                    ctx.bindTexture(value, numTextures);
                    value = numTextures++;
                }
                if (material.program.hasUniform(uniformName)) {
                    material.program.setUniform(uniformName, value)
                }
            }
            ctx.drawMesh();
            ctx.popModelMatrix();
        })
        ctx.popState();
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        renderToCubemap(ctx, this.reflectionMap, this.drawScene.bind(this));
        downsampleCubemap(ctx, this.reflectionMap, this.reflectionMap64);
        downsampleCubemap(ctx, this.reflectionMap64, this.reflectionMap32);
        downsampleCubemap(ctx, this.reflectionMap32, this.reflectionMap16);
        convolveCubemap(ctx, this.reflectionMap16, this.irradianceMap);

        this.drawScene(true)

        this.gui.draw();
    }
})
