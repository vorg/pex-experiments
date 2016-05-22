var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var WebVRPolyfil    = require('webvr-polyfill');
var Vec3            = require('pex-math/Vec3');
var Vec4            = require('pex-math/Vec4');
var Mat4            = require('pex-math/Mat4');
var random          = require('pex-random')

//Generates a perspective projection matrix with the given field of view.
//this is primarily useful for generating projection matrices to be used
//with the still experiemental WebVR API.
//http://glmatrix.net/docs/mat4.js.html#line1793
Mat4.perspectiveFromFieldOfView = function (out, fov, near, far) {
    var upTan = Math.tan(fov.upDegrees * Math.PI/180.0),
        downTan = Math.tan(fov.downDegrees * Math.PI/180.0),
        leftTan = Math.tan(fov.leftDegrees * Math.PI/180.0),
        rightTan = Math.tan(fov.rightDegrees * Math.PI/180.0),
        xScale = 2.0 / (leftTan + rightTan),
        yScale = 2.0 / (upTan + downTan);
    out[0] = xScale;
    out[1] = 0.0;
    out[2] = 0.0;
    out[3] = 0.0;
    out[4] = 0.0;
    out[5] = yScale;
    out[6] = 0.0;
    out[7] = 0.0;
    out[8] = -((leftTan - rightTan) * xScale * 0.5);
    out[9] = ((upTan - downTan) * yScale * 0.5);
    out[10] = far / (near - far);
    out[11] = -1.0;
    out[12] = 0.0;
    out[13] = 0.0;
    out[14] = (far * near) / (near - far);
    out[15] = 0.0;
    return out;
}

function CardboardViewer(params) {
  // A machine readable ID.
  this.id = params.id;
  // A human readable label.
  this.label = params.label;

  // Field of view in degrees (per side).
  this.fov = params.fov;

  // Distance between lens centers in meters.
  this.interLensDistance = params.interLensDistance;
  // Distance between viewer baseline and lens center in meters.
  this.baselineLensDistance = params.baselineLensDistance;
  // Screen-to-lens distance in meters.
  this.screenLensDistance = params.screenLensDistance;

  // Distortion coefficients.
  this.distortionCoefficients = params.distortionCoefficients;
  // Inverse distortion coefficients.
  // TODO: Calculate these from distortionCoefficients in the future.
  this.inverseCoefficients = params.inverseCoefficients;
}


var State = {
    vrDisplay: null,
    orientation: [0, 0, 0, 1],
    position: [0, 0, 0],
    projectionMat: Mat4.create(),
    viewMat: Mat4.create(),
    quatMat: Mat4.create(),
    cubes: []
}

function init(win) {
    State.window = win;
    var ctx = win.getContext();
    var res = win.getResources();

    State.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
    ctx.bindProgram(State.showNormalsProgram);

    var cube = createCube();
    var cubeAttributes = [
        { data: cube.positions, location: ctx.ATTRIB_POSITION },
        { data: cube.normals, location: ctx.ATTRIB_NORMAL }
    ];
    var cubeIndices = { data: cube.cells };
    State.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

    var cube = createCube();
    var cubeAttributes = [
        { data: cube.positions, location: ctx.ATTRIB_POSITION },
        { data: cube.normals, location: ctx.ATTRIB_NORMAL }
    ];
    var cubeIndices = { data: cube.cells };
    State.cubeMesh = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

    random.seed(52);
    for(var i=0; i<50; i++) {
        var pos = random.vec3(10);
        if (Vec3.length(pos) > 2) {
            State.cubes.push(pos)
        }
    }

    initVR()
}

function initVR() {
    if (navigator.getVRDisplays) {
        navigator.getVRDisplays().then(function (displays) {
            console.log('initVR', displays[0].displayName);
            console.log('initVR', displays);
            State.vrDisplay = displays[0]
            var pose = State.vrDisplay.getPose();
            Vec3.set(State.position, pose.position || [0,0,0]); 
            Vec4.set(State.orientation, pose.orientation); 
            console.log('initVR', 'pose', pose);
            console.log('initVR', 'position', State.position);
            console.log('initVR', 'orientation', State.orientation);
            //CardboardViewer
            var altergazeViewer = new CardboardViewer({
                id: 'Altergaze5C',
                label: 'Altergaze (iPhone 5C)',
                fov: 40,
                interLensDistance: 0.050,
                baselineLensDistance: 0.027,
                screenLensDistance: 0.026,
                distortionCoefficients: [0.19, 0.07],
                //this should be calculated from distrotion coefficient but it seems to be unused
                //https://github.com/borismus/webvr-polyfill/pull/73
                inverseCoefficients: [-0.4410035, 0.42756155, -0.4804439, 0.5460139,
                  -0.58821183, 0.5733938, -0.48303202, 0.33299083, -0.17573841,
                  0.0651772, -0.01488963, 0.001559834]
            })
            //TODO: add this as a normal cardboard chooser option
            if (State.vrDisplay.onViewerChanged_) {
                console.log('Setting altergaze viewr')
                State.vrDisplay.onViewerChanged_(altergazeViewer)
            }
        });
    }
}

function drawScene(ctx) {
    ctx.bindProgram(State.showNormalsProgram);
    ctx.bindMesh(State.cubeMesh);

    for(var i=0; i<State.cubes.length; i++) {
        ctx.pushModelMatrix();
        ctx.translate(State.cubes[i])
        ctx.drawMesh();
        ctx.popModelMatrix();
    }

    ctx.pushModelMatrix();
    ctx.translate([0, -1, 0])
    ctx.scale([15, 1, 15])
    ctx.drawMesh();
    ctx.popModelMatrix();
}

function drawSceneEye(ctx, width, height, eyeFov, eyeOffset) {
    var projectionMat = State.projectionMat;
    if (eyeFov.leftDegrees) {
        Mat4.perspectiveFromFieldOfView(projectionMat, eyeFov,  0.1, 1000)
    }
    else {
        Mat4.perspective(projectionMat, eyeFov, width/height, 0.1, 1000)
    }
    ctx.setProjectionMatrix(projectionMat);

    var viewMat = State.viewMat;
    var quatMat = State.quatMat;
    Mat4.identity(viewMat);
    Mat4.translate(viewMat, State.position)
    Mat4.fromQuat(quatMat, State.orientation); 
    Mat4.mult(viewMat, quatMat)
    
    if (eyeOffset) {
        Mat4.translate(viewMat, eyeOffset)
    }

    Mat4.invert(viewMat);
    ctx.setViewMatrix(viewMat);

    drawScene(ctx)
}

function updatePose() {
    if (State.vrDisplay) {
        var pose = State.vrDisplay.getPose();
        
        Vec4.set(State.orientation, pose.orientation); 
    
        if (pose.position) {
            Vec3.set(State.position, pose.position); 
        }
    }
}

function draw(win) {
    updatePose();

    var W = win.getWidth();
    var H = win.getHeight();
    
    var ctx = win.getContext();
    ctx.setClearColor(1, 0.2, 0.2, 1);
    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
    ctx.setDepthTest(true);
   
    //cardboard / mobile
    if (State.vrDisplay && State.vrDisplay.getEyeParameters("left")) {
        var leftEye = State.vrDisplay.getEyeParameters("left");
        ctx.setViewport(0, 0, W/2, H)
        drawSceneEye(ctx, W/2, H, leftEye.fieldOfView, leftEye.offset);
        
        var rightEye = State.vrDisplay.getEyeParameters("right");
        ctx.setViewport(W/2, 0, W/2, H)
        drawSceneEye(ctx, W/2, H, rightEye.fieldOfView, rightEye.offset)
    }
    //desktop browser
    else {
        ctx.setViewport(0, 0, W, H)
        drawSceneEye(ctx, W, H, 45)
    }

    if (win.getTime().getElapsedFrames() % 30 == 0) {
        console.log('FSP : ' + win.getTime().getFPS());
    }
}

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: true,
        pixelRatio: 2
    },
    resources: {
        showNormalsVert: { glsl: glslify(__dirname + '/assets/ShowNormals.vert') },
        showNormalsFrag: { glsl: glslify(__dirname + '/assets/ShowNormals.frag') },
    },
    init: function() {
        init(this);
    },
    draw: function() {
        draw(this);
    }
})
