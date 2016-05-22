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
    this.id = params.id;
    this.label = params.label;
    this.fov = params.fov;
    this.interLensDistance = params.interLensDistance;
    this.baselineLensDistance = params.baselineLensDistance;
    this.screenLensDistance = params.screenLensDistance;
    this.distortionCoefficients = params.distortionCoefficients;
    this.inverseCoefficients = params.inverseCoefficients;
}

function nop(e) {
}

function throwError(msg) {
    return function() {
        throw new Error(msg);
    }
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
    State.showNormalsProgram2 = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
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
    State.cubeMesh2 = ctx.createMesh(cubeAttributes, cubeIndices, ctx.TRIANGLES);

    random.seed(52);
    for(var i=0; i<50; i++) {
        var pos = random.vec3(10);
        if (Vec3.length(pos) > 2) {
            State.cubes.push(pos)
        }
    }

    initVR(win)
}

function initVR(win) {
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
            State.altergazeViewer = new CardboardViewer({
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
            //add cardboard button
            var cardboardBtn = document.createElement('div')
            var cardboardIcon = new Image();
            cardboardIcon.src = 'assets/cardboard64.png';
            cardboardIcon.marginLeft = '-32px';
            cardboardBtn.appendChild(cardboardIcon);
            cardboardBtn.style.position = 'fixed';
            cardboardBtn.style.left = '50%';
            cardboardBtn.style.bottom = '20px'
            document.body.appendChild(cardboardBtn)
            cardboardBtn.addEventListener('click', function() {
                cardboardBtn.style.display = 'none'
                onVRRequestPresent(win)
            })
            //onVRRequestPresent(win) //TEMP
            //cardboardBtn.style.display = 'none' //TEMP
            window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
        }).catch(function(e) {
            console.log(e);
            console.log(e.stack);
        });
    }
}

function drawScene(ctx) {
    ctx.bindProgram(State.showNormalsProgram);
    ctx.bindMesh(State.cubeMesh);
    ctx.bindProgram(State.showNormalsProgram2);
    ctx.bindMesh(State.cubeMesh2);

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

function drawSceneView(ctx, width, height, eye) {
    var projectionMat = State.projectionMat;
    if (eye) {
        Mat4.perspectiveFromFieldOfView(projectionMat, eye.fieldOfView,  0.1, 1000)
    }
    else {
        Mat4.perspective(projectionMat, 60, width/height, 0.1, 1000)
    }
    ctx.setProjectionMatrix(projectionMat);

    var viewMat = State.viewMat;
    var quatMat = State.quatMat;
    Mat4.identity(viewMat);
    Mat4.translate(viewMat, State.position)
    Mat4.fromQuat(quatMat, State.orientation); 
    Mat4.mult(viewMat, quatMat)

    if (eye) {
        Mat4.translate(viewMat, eye.offset)
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

//TODO: Match VR Display refresh rate `vrDisplay.requestAnimationFrame(onAnimationFrame)`
function draw(win) {
    updatePose();

    var W = win.getWidth();
    var H = win.getHeight();
    
    var ctx = win.getContext();
    ctx.setClearColor(1, 0.2, 0.2, 1);
    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
    ctx.setDepthTest(true);
   
    //cardboard / mobile
    if (State.vrDisplay && State.vrDisplay.isPresenting) {
        var leftEye = State.vrDisplay.getEyeParameters("left");
        ctx.setViewport(0, 0, W/2, H)
        drawSceneView(ctx, W/2, H, leftEye);
        
        var rightEye = State.vrDisplay.getEyeParameters("right");
        ctx.setViewport(W/2, 0, W/2, H)
        drawSceneView(ctx, W/2, H, rightEye)

        State.vrDisplay.submitFrame(State.pose);
    }
    //desktop browser
    else {
        ctx.setViewport(0, 0, W, H)
        drawSceneView(ctx, W, H)
    }

    if (win.getTime().getElapsedFrames() % 30 == 0) {
        //console.log('FSP : ' + win.getTime().getFPS());
    }
}

//TODO: override pex-sys canvas resizing
function onResize(win) {
    if (State.vrDisplay && State.vrDisplay.isPresenting) {
        var canvas = win.getContext().getGL().canvas;
        var leftEye = State.vrDisplay.getEyeParameters("left");
        var rightEye = State.vrDisplay.getEyeParameters("right");
        canvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2 * win.getPixelRatio();
        canvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight) * win.getPixelRatio();

        //prevent iOS Safari bars from showing after rotation
        canvas.style.position = 'relative';
        canvas.parentNode.style.position = 'relative';
    }
}

function onVRRequestPresent (win) {
    console.log('onVRRequestPresent', win.getContext().getGL().canvas)
    State.vrDisplay.requestPresent([{ source: win.getContext().getGL().canvas }])
        .then(nop, throwError('VrDisplay requestPresent failed'))
}

function onVRExitPresent (win) {
    State.vrDisplay.exitPresent([{ source: win.getContext().getGL().canvas }])
        .then(nop, throwError('VrDisplay exitPresent failed'))
}

function onVRPresentChange () {
    console.log('onVRPresentChange isPresenting:', State.vrDisplay.isPresenting)

    //TEMP: Inject AltergazeVR Headset spec
    if (State.vrDisplay.onViewerChanged_) {
        console.log('Setting altergaze viewr')
        State.vrDisplay.onViewerChanged_(State.altergazeViewer)
    }

    // When we begin or end presenting, the canvas should be resized to the
    // recommended dimensions for the display.
    //TODO: onResize();
    if (State.vrDisplay.isPresenting) {
        if (State.vrDisplay.capabilities.hasExternalDisplay) {
            // Because we're not mirroring any images on an external screen will
            // freeze while presenting. It's better to replace it with a message
            // indicating that content is being shown on the VRDisplay.
            //TODO: presentingMessage.style.display = "block";
            // On devices with an external display the UA may not provide a way
            // to exit VR presentation mode, so we should provide one ourselves.
            //TODO: VRSamplesUtil.removeButton(vrPresentButton);
            //TODO: vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "media/icons/cardboard64.png", onVRExitPresent);
        }
    } else {
        // If we have an external display take down the presenting message and
        // change the button back to "Enter VR".
        if (State.vrDisplay.capabilities.hasExternalDisplay) {
            //TODO: presentingMessage.style.display = "";
            //TODO: VRSamplesUtil.removeButton(vrPresentButton);
            //TODO: vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);
        }
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
    },
    onWindowResize: function() {
        onResize(this);
    }
})
