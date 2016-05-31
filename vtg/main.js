var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var TexturedProgram = require('pex-materials/textured')
var GUI             = require('pex-gui')

var parseVTG        = require('./vtg/parse')

var DATA_DIR = isBrowser ? 'data' : __dirname + '/data';

//var filterDataBuf = fs.readFileSync(__dirname + '/../data/czerwone_kafelki.vtg')
var Window = require('pex-sys/Window')
var pixelRatio = 1.5;
Window.create({
    settings: {
        width: 1280,
        height: 720,
        debug: true,
    },
    resources: {
        tex1: { binary: DATA_DIR + '/sciana.vtg' },
        tex2: { binary: DATA_DIR + '/fantasy.vtg' },
        tex3: { binary: DATA_DIR + '/hypno_paski.vtg' },
        tex4: { binary: DATA_DIR + '/luski.vtg' },
    },
    textures: [],
    selectedTexture: 0,
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        var texData1 = parseVTG(res.tex1, false)
        var texData2 = parseVTG(res.tex2, false)
        var texData3 = parseVTG(res.tex3, false)
        var texData4 = parseVTG(res.tex4, false)

        this.textures[0] = ctx.createTexture2D(new Uint8Array(texData1.pixels), texData1.width, texData1.height, { format: ctx.getGL().RGB })
        this.textures[1] = ctx.createTexture2D(new Uint8Array(texData2.pixels), texData2.width, texData2.height, { format: ctx.getGL().RGB })
        this.textures[2] = ctx.createTexture2D(new Uint8Array(texData3.pixels), texData3.width, texData3.height, { format: ctx.getGL().RGB })
        this.textures[3] = ctx.createTexture2D(new Uint8Array(texData4.pixels), texData4.width, texData4.height, { format: ctx.getGL().RGB })

        var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight())
        this.addEventListener(gui)

        this.gui.addTexture2DList('Texture', this, 'selectedTexture', this.textures.map(function(tex, i) {
            return { texture: tex, value: i }
        }))

        this.camera  = new PerspCamera(45,this.getAspectRatio(),0.001,20.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.texturedProgram = ctx.createProgram(TexturedProgram.Vert, TexturedProgram.Frag);
        ctx.bindProgram(this.texturedProgram);

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.uvs, location: ctx.ATTRIB_TEX_COORD_0 }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        ctx.setClearColor(0.2, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.texturedProgram);
        this.texturedProgram.setUniform('uTexture', 0)
        ctx.bindTexture(this.textures[this.selectedTexture])
        ctx.bindMesh(this.cubeMesh);
        ctx.drawMesh();

        this.gui.draw()
    }
})
