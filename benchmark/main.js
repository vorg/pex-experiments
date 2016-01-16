var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var Cubes           = require('./scenes/cubes');

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : false
    },
    resources: {
    },
    init: function() {
        var ctx = this.getContext();
        var width = this.getWidth();
        var height = this.getHeight();
        this.initScenes(ctx, width, height);
        this.startScene(0);
    },
    initScenes: function(ctx, width, height) {
        this.currentScene = -1;
        this.scenes = [];
        this.scenes.push(new Cubes(width, height));
    },
    startScene: function(idx) {
        var ctx = this.getContext();
        this.currentScene = idx;
        this.sceneStartTime = this.getTime().getElapsedSeconds() * 1000;
        this.sceneRAFs = 0;
        this.sceneRects = 0;
        this.scenes[this.currentScene].init(ctx);

        console.time('run');
    },
    draw: function() {
        var ctx = this.getContext();

        ctx.setClearColor(1, 0.2, 0.2, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        if (this.currentScene == -1) {
            return;
        }

        this.sceneRAFs++;

        this.sceneRects += this.scenes[this.currentScene].draw(ctx, this.getTime().getElapsedSeconds());

        var now = this.getTime().getElapsedSeconds() * 1000;
        var lapsed = now - this.sceneStartTime;
        if (lapsed >= 10000) {
            console.log(lapsed);
            this.scenes[this.currentScene].shutdown(ctx);
            this.currentScene = -1;

            var rafs = this.sceneRAFs;
            var rects = this.sceneRects;
            console.timeEnd('run');
			console.log('Number of Rafs', rafs);
			console.log('Time per Rafs', (lapsed / rafs).toFixed(2), 'ms');
			console.log('Total Rects', rects);
			console.log('Rects / second', (rects / lapsed * 1000).toFixed(2));
			console.log('Rects / 16.67ms', (rects / lapsed * 60).toFixed(2));
            console.log('FPS', this.getTime().getFPS());
			console.log('Done!!');
        }
    }
})
