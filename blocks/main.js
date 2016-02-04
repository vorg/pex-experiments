var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var random          = require('pex-random')
var fx              = require('pex-fx')
var SSAOv2          = require('./SSAO')
var Vec3            = require('pex-math/Vec3')
var MathUtils       = require('pex-math/Utils')
var R               = require('ramda')
var GUI             = require('pex-gui')
var fs              = require('fs')

var MAX_DEPTH = 20

function divide(parent, rects) {
    rects.push(parent);

    var depth = parent[4]

    var shouldDivide = random.chance(0.1 + 1/(depth*0.5+1));
    if (depth <= 1) {
        shouldDivide = true
    }

    if (depth >= MAX_DEPTH || !shouldDivide) {
        return rects
    }

    var numDivisions = random.int(2, 5)
    var horizontal = random.chance(0.5);
    if (depth == 0) horizontal = false;
    if (depth == 1) horizontal = true;

    for(var i=0; i<numDivisions; i++) {
        var child = null
        if (horizontal) {
            child = [
                parent[0] + parent[2] * i * 1 / numDivisions,
                parent[1],
                parent[2] * 1 / numDivisions,
                parent[3],
                depth + 1
            ]
        }
        else {
            child = [
                parent[0],
                parent[1] + parent[3] * i * 1 / numDivisions,
                parent[2],
                parent[3] * 1 / numDivisions,
                depth + 1
            ]
        }
        var offset = 0.002;
        child[0] += offset
        child[1] += offset
        child[2] -= 2*offset
        child[3] -= 2*offset
        divide(child, rects)
    }
    return rects
}

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : false
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
        solidColorVert: { glsl: glslify(__dirname + '/assets/SolidColor.vert') },
        solidColorFrag: { glsl: glslify(__dirname + '/assets/SolidColor.frag') },
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight())

        random.seed(1)

        var ssaoKernel = [];
        for(var i=0; i<64; i++) {
            var sample = [
                random.float() * 2 - 1,
                random.float() * 2 - 1,
                random.float(),
                1
            ]
            Vec3.normalize(sample)
            var scale = random.float()
            scale = MathUtils.lerp(0.1, 1.0, scale * scale);
            Vec3.scale(sample, scale)
            ssaoKernel.push(sample)
        }
        var ssaoKernelData = new Float32Array(R.flatten(ssaoKernel))

        var ssaoNoise = [];
        for(var i=0; i<64; i++) {
            var sample = [
                random.float() * 2 - 1,
                random.float() * 2 - 1,
                0,
                1
            ]
            ssaoNoise.push(sample)
        }
        var ssaoNoiseData = new Float32Array(R.flatten(ssaoNoise))

        this.depthMap = ctx.createTexture2D(null, this.getWidth(), this.getHeight(), { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        this.ssaoKernelMap = ctx.createTexture2D(ssaoKernelData, 8, 8, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true });
        this.ssaoNoiseMap = ctx.createTexture2D(ssaoNoiseData, 4, 4, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true });
        //this.rects = divide([-1, -0.5, 2, 1, 0], [])
        this.rects = divide([-2, -1, 4, 2, 0], [])
        this.rects.forEach(function(rect) {
            if (rect[4] <= 2) rect.push([0,1,0.5,1])
        })

        this.camera  = new PerspCamera(45,this.getAspectRatio(), 0.1, 10.0);
        this.camera.lookAt([0, 1, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        this.solidColorProgram = ctx.createProgram(res.solidColorVert, res.solidColorFrag);
        ctx.bindProgram(this.solidColorProgram);

        var cube = createCube();
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        var cubeWireIndices = { data: cube.cells };
        this.cubeWireMesh = ctx.createMesh(cubeAttributes, cubeWireIndices, ctx.LINES);

        this.fx = fx(ctx)

        this.gui.addHeader('Settings')
        this.gui.addTexture2D('Kernel', this.ssaoKernelMap)
        this.gui.addTexture2D('Noise', this.ssaoNoiseMap)

        var prevCode = '';
        var shaderFile = __dirname + '/SSAO.frag';
        if (false)
        var vert = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
        if (false)
        fs.watch(shaderFile, { persistent: true, recursive: false }, function(e, filename) {
            var frag = fs.readFileSync(shaderFile, 'utf8');
            if (frag != prevCode) {
                try {
                    console.log('COMPILE >>>> ')
                    var prop = ctx.createProgram(vert, frag)
                    prop.dispose()
                    this.fx.ssao.updateFrag(frag)
                }
                catch(e) {
                    console.log(e)
                }
            }
            prevCode = frag;
        }.bind(this));
    },
    drawScene: function() {
        var ctx = this.getContext()
        ctx.setClearColor(1, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        var levelHeight = 0.04;
        ctx.bindProgram(this.solidColorProgram);
        ctx.setLineWidth(2)
        this.rects.forEach(function(rect) {
            ctx.pushModelMatrix()
            ctx.translate([rect[0] + rect[2]/2, levelHeight*(1+rect[4])/2, rect[1] + rect[3]/2])
            ctx.scale([rect[2], levelHeight*(1+rect[4]), rect[3]])
            this.solidColorProgram.setUniform('uColor', rect[5] || [1,1,1,1])
            ctx.bindMesh(this.cubeMesh);
            ctx.drawMesh();
            this.solidColorProgram.setUniform('uColor', [0.5,0.5,0.5,1])
            ctx.bindMesh(this.cubeWireMesh);
            ctx.drawMesh();
            ctx.popModelMatrix()
        }.bind(this))
    },
    drawSceneNormals: function() {
        var ctx = this.getContext()
        ctx.setClearColor(1, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        var levelHeight = 0.04;
        ctx.bindProgram(this.showNormalsProgram);
        ctx.setLineWidth(2)
        this.rects.forEach(function(rect) {
            ctx.pushModelMatrix()
            ctx.translate([rect[0] + rect[2]/2, levelHeight*(1+rect[4])/2, rect[1] + rect[3]/2])
            ctx.scale([rect[2], levelHeight*(1+rect[4]), rect[3]])
            this.solidColorProgram.setUniform('uColor', [1,1,1,1])
            ctx.bindMesh(this.cubeMesh);
            ctx.drawMesh();
            ctx.popModelMatrix()
        }.bind(this))
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());

        var W = this.getWidth();
        var H = this.getHeight()

        ctx.setViewport(0, 0, W, H);

        var root = this.fx.reset();
        var color = root.render({ drawFunc: this.drawScene.bind(this), depth: this.depthMap });
        var normals = root.render({ drawFunc: this.drawSceneNormals.bind(this), depth: this.depthMap });
        var ssao = root.ssao({ depthMap: this.depthMap, normalMap: normals, kernelMap: this.ssaoKernelMap, noiseMap: this.ssaoNoiseMap, camera: this.camera, strength: 1, offset: 0.2, width: W, height: H }).blur3().blur3();
        var fin = color.mult(ssao);

        color.blit({x: 0, y: H/2, width: W/2, height: H/2});
        root.asFXStage(this.depthMap, 'bla').blit({x: W/2, y: H/2, width: W/2, height: H/2});
        normals.blit({x: W/2, y: H/2, width: W/2, height: H/2});
        ssao.blit({x: 0, y: 0, width:W/2, height: H/2});
        fin.blit({x: W/2, y: 0, width: W/2, height: H/2});

        //this.gui.draw();
    }
})
