var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');

var ASSETS_DIR = isBrowser ? 'assets' : __dirname + '/assets';

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
        flatVert: { glsl: glslify(__dirname + '/assets/Flat.vert') },
        flatFrag: { glsl: glslify(__dirname + '/assets/Flat.frag') },
        normalBumpVert: { glsl: glslify(__dirname + '/assets/NormalBump.vert') },
        normalBumpFrag: { glsl: glslify(__dirname + '/assets/NormalBump.frag') },
        parallaxBumpVert: { glsl: glslify(__dirname + '/assets/ParallaxBump.vert') },
        parallaxBumpFrag: { glsl: glslify(__dirname + '/assets/ParallaxBump.frag') },
        //baseColorImg : { image: ASSETS_DIR + '/textures/pex-scifi-color.png'},
        //normalImg : { image: ASSETS_DIR + '/textures/pex-scifi-normal.png'},
        //heightImg : { image: ASSETS_DIR + '/textures/pex-scifi-height.png'},

        baseColorImg : { image: ASSETS_DIR + '/textures/brickwall.jpg'},
        normalImg : { image: ASSETS_DIR + '/textures/brickwall_normal.jpg'},
        heightImg : { image: ASSETS_DIR + '/textures/brickwall.jpg'}
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.camera  = new PerspCamera(45,this.getAspectRatio()/3,0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(4.0);
        this.addEventListener(this.arcball);

        //TODO: texture flipping by default?
        this.baseColorTex = ctx.createTexture2D(res.baseColorImg, res.baseColorImg.width, res.baseColorImg.height, { flipY: false, mipmap: true });
        this.normalTex = ctx.createTexture2D(res.normalImg, res.normalImg.width, res.normalImg.height, { flipY: false, mipmap: true });
        this.heightTex = ctx.createTexture2D(res.heightImg, res.heightImg.width, res.heightImg.height, { flipY: false, mipmap: true });

        if (isBrowser) {
            var gl = ctx.getGL();
            gl.getExtension('OES_standard_derivatives')
            var anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');

            ctx.bindTexture(this.baseColorTex);
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);

            ctx.bindTexture(this.normalTex);
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);

            ctx.bindTexture(this.heightTex);
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        }

        this.flatProgram = ctx.createProgram(res.flatVert, res.flatFrag);
        this.normalBumpProgram = ctx.createProgram(res.normalBumpVert, res.normalBumpFrag);
        this.parallaxBumpProgram = ctx.createProgram(res.parallaxBumpVert, res.parallaxBumpFrag);


        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL },
            { data: cube.uvs, location: ctx.ATTRIB_TEX_COORD_0 }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        this.lightPosition = [5, 10, 2];
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.1, 0.1, 0.1, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindMesh(this.cubeMesh);

        var W = this.getWidth();
        var H = this.getHeight();

        ctx.setViewport(0, 0, W/3, H)
        ctx.bindTexture(this.baseColorTex, 0);
        ctx.bindTexture(this.normalTex, 1);
        ctx.bindTexture(this.heightTex, 2);
        ctx.bindProgram(this.flatProgram);
        this.flatProgram.setUniform('uBaseColorTex', 0);
        this.flatProgram.setUniform('uLightPosition', this.lightPosition);
        ctx.drawMesh();

        ctx.setViewport(W/3, 0, W/3, H)
        ctx.bindTexture(this.baseColorTex, 0);
        ctx.bindTexture(this.normalTex, 1);
        ctx.bindTexture(this.heightTex, 2);
        ctx.bindProgram(this.normalBumpProgram);
        this.normalBumpProgram.setUniform('uBaseColorTex', 0);
        this.normalBumpProgram.setUniform('uNormalTex', 1);
        this.normalBumpProgram.setUniform('uLightPosition', this.lightPosition);
        ctx.drawMesh();

        ctx.setViewport(2*W/3, 0, W/3, H)
        ctx.bindTexture(this.baseColorTex, 0);
        ctx.bindTexture(this.normalTex, 1);
        ctx.bindTexture(this.heightTex, 2);
        ctx.bindProgram(this.parallaxBumpProgram);
        this.parallaxBumpProgram.setUniform('uBaseColorTex', 0);
        this.parallaxBumpProgram.setUniform('uNormalTex', 1);
        this.parallaxBumpProgram.setUniform('uLightPosition', this.lightPosition);
        ctx.drawMesh();

        ctx.setViewport(0, 0, W, H)
    }
})
