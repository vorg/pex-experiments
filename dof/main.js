var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var fx              = require('pex-fx');
var random          = require('pex-random');
var GUI             = require('pex-gui');
var CheapDOF        = require('./fx/CheapDof')

var State = {
    instances: [],
    blur: 0.5,
    depth: 10,
    depthRange: 5
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
    },
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight(), this.getPixelRatio());
        this.addEventListener(gui);

        this.camera  = new PerspCamera(45,this.getAspectRatio(), 1, 20.0);
        this.camera.lookAt([0, 0, 3], [0, 0, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setDistance(3.0);
        this.addEventListener(this.arcball);

        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        ctx.bindProgram(this.showNormalsProgram);

        var instances = State.instances = [];
        var R = 1.2;
        var r = 0.2;
        for(var i=0; i<1000; i++) {
            var a = i/10;
            var x = R * Math.cos(a) + random.float(-r, r);
            var y = R * Math.sin(a) + random.float(-r, r);
            var z = 1 - a/10;
            instances.push([x, y, z]);
        }

        var cube = createCube(0.2);
        var cubeAttributes = [
            { data: cube.positions, location: ctx.ATTRIB_POSITION },
            { data: cube.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var cubeIndices = { data: cube.cells };
        this.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

        this.depthMap = ctx.createTexture2D(null, this.getWidth(), this.getHeight(), { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        this.fx = fx(ctx);

        gui.addTexture2D('Depth map', this.depthMap);
        gui.addParam('Blur', State, 'blur');
        gui.addParam('Depth', State, 'depth', { min: this.camera.getNear(), max: this.camera.getFar() });
        gui.addParam('Depth range', State, 'depthRange', {min: 0, max: 5});
    },
    drawScene: function() {
        var ctx = this.getContext();

        ctx.setViewMatrix(this.camera.getViewMatrix());
        ctx.setClearColor(0.9, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        ctx.bindProgram(this.showNormalsProgram);
        ctx.bindMesh(this.cubeMesh);
        for(var i=0; i<State.instances.length; i++) {
            ctx.pushModelMatrix();
            ctx.translate(State.instances[i])
            ctx.drawMesh();
            ctx.popModelMatrix();
        }
    },
    draw: function() {
        var ctx = this.getContext();

        this.arcball.apply();
        ctx.setClearColor(0, 0, 0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);


        var root = this.fx.reset();
        var color = root.render({ drawFunc: this.drawScene.bind(this), depth: this.depthMap });
        var blurred = color.blur({ iterations: 8, strength: State.blur });
        var final = color.cheapDof({ blurredTex: blurred, depthMap: this.depthMap, depth: State.depth, depthRange: State.depthRange, camera: this.camera })
        final.blit()

        this.gui.draw();
    }
})
