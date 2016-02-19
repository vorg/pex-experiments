var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var GUI             = require('pex-gui');
var Vec3            = require('pex-math/Vec3');

//var Font            = require('./assets/fonts/LatoRegular-sdf.json');
var Font            = require('./assets/fonts/InconsolataRegular-sdf.json');
var SpriteTextBox   = require('./SpriteTextBox')


//https://github.com/libgdx/libgdx/wiki/Distance-field-fonts
var ASSETS_DIR = isBrowser ? 'assets' : __dirname + '/assets';
var DPI = 2;

var text = 'You can pass a custom measure function which takes the text being wrapped, the start (inclusive) and end (exclusive) indices into the string, and the desired width. The return value should be an object with { start, end } indices, representing the actual glyphs that can be rendered within those bounds.';

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : false,
        pixelRatio: DPI
    },
    color: [1,1,1,1],
    fontSize: 30,
    debug: true,
    offset: 0,
    resources: {
        solidColorVert: { glsl: glslify(__dirname + '/assets/SolidColor.vert') },
        solidColorFrag: { glsl: glslify(__dirname + '/assets/SolidColor.frag') },
        sdfFontVert: { glsl: glslify(__dirname + '/assets/SDFFont.vert') },
        sdfFontFrag: { glsl: glslify(__dirname + '/assets/SDFFont.frag') },
        fontImage: { image: ASSETS_DIR + '/fonts/' + Font.pages[0] },
        texts: { text: ASSETS_DIR + '/texts.txt' }
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        ctx.getGL().getExtension('OES_standard_derivatives')

        this.fontTex = ctx.createTexture2D(res.fontImage, res.fontImage.width, res.fontImage.height, { mipmap: false })

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.addEventListener(this.gui)

        console.log(res.fontImage.width)

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.01,150.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.solidColorProgram = ctx.createProgram(res.solidColorVert, res.solidColorFrag);
        ctx.bindProgram(this.solidColorProgram);
        this.solidColorProgram.setUniform('uColor', [1, 0, 0, 1]);

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        this.sdfFontProgram = ctx.createProgram(res.sdfFontVert, res.sdfFontFrag);
        ctx.bindProgram(this.sdfFontProgram);
        this.sdfFontProgram.setUniform('texture', 0);
        this.sdfFontProgram.setUniform('color', [1,1,1,1]);

        this.gui.addParam('fontSize', this, 'fontSize', { min: 4  , max: 64 });
        this.gui.addParam('debug', this, 'debug');

        this.texts = res.texts.trim().split('\n').map(function(line) {
            var text = new SpriteTextBox(ctx, line, {
              fontSize: this.fontSize * DPI / 500,
              lineHeight: 1.2,
              font: Font,
              wrap: 320 * DPI / 500
            });
            text.position = [Math.random()*6-3-0.5, Math.random()*6-3-0.5, Math.random()*4-2-2]
            return text;
        }.bind(this))


    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.0, 0.0, 0.0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);
        ctx.setBlend(true)
        ctx.setBlendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);

        ctx.setLineWidth(2);


        this.gui.draw();

        ctx.pushModelMatrix();
        var s = this.texts[0].opts.scale;


        ctx.bindTexture(this.fontTex, 0)


        ctx.bindProgram(this.sdfFontProgram);
        this.texts.forEach(function(text) {
            ctx.pushModelMatrix()
            ctx.translate(text.position)
            ctx.scale([s, -s, s])
            text.setFontSize(this.fontSize * DPI / 500);
            ctx.bindMesh(text.mesh);
            ctx.drawMesh();
            ctx.popModelMatrix();
        }.bind(this))


        if (this.debug) {
            ctx.bindProgram(this.solidColorProgram);
            this.texts.forEach(function(text) {
                ctx.pushModelMatrix()
                ctx.translate(text.position)
                ctx.scale([s, -s, s])
                ctx.bindMesh(text.debugMesh);
                ctx.drawMesh();
                ctx.popModelMatrix();
            }.bind(this))
        }

        ctx.popModelMatrix();

        this.gui.draw();
    }
})
