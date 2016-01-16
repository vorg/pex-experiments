var Window          = require('pex-sys/Window');
var PerspCamera     = require('pex-cam/PerspCamera');
var Arcball         = require('pex-cam/Arcball');
var createCube      = require('primitive-cube');
var glslify         = require('glslify-promise');
var isBrowser       = require('is-browser');
var Cubes           = require('./scenes/cubes');
var GUI             = require('pex-gui');

Window.create({
    settings: {
        width:  1280,
        height: 720,
        fullScreen: isBrowser ? true : true
    },
    resources: {
    },
    init: function() {
        var ctx = this.getContext();
        var width = this.getWidth();
        var height = this.getHeight();
        this.initScenes(ctx, width, height);
        this.startScene(0);
        this.initGUI(ctx);
    },
    initGUI: function(ctx) {
        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.fpsLabel = this.gui.addLabel('FPS:');

        this.gui.addHeader('Scenes');
        this.sceneLabels = this.scenes.map(function(scene) {
            return this.gui.addLabel(scene.name);
        }.bind(this))
    },
    initScenes: function(ctx, width, height) {
        this.currentScene = -1;
        this.scenes = [];
        this.scenes.push(new Cubes(width, height, 50));
        this.scenes.push(new Cubes(width, height, 500));
        this.scenes.push(new Cubes(width, height, 1000));
        this.scenes.push(new Cubes(width, height, 2500));
        this.scenes.push(new Cubes(width, height, 5000));
        this.scenes.push(new Cubes(width, height, 10000));
    },
    stopScene: function() {
        if (this.currentScene != -1) {
            var ctx = this.getContext();

            this.scenes[this.currentScene].dispose(ctx);
            this.currentScene = -1;
        }
    },
    startScene: function(idx) {
        this.stopScene();

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
            this.gui.draw();
            return;
        }

        this.sceneRAFs++;

        this.sceneRects += this.scenes[this.currentScene].draw(ctx, this.getTime().getElapsedSeconds());

        var now = this.getTime().getElapsedSeconds() * 1000;
        var lapsed = now - this.sceneStartTime;
        if (lapsed >= 5000) {
            console.log(lapsed);
            var currScene = this.currentScene;
            var nextScene = currScene + 1;
            this.stopScene();
            if (nextScene < this.scenes.length) {
                this.startScene(nextScene);
            }

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

            var fps = this.getTime().getFPS().toFixed(2);
            this.sceneLabels[currScene].setTitle(this.scenes[currScene].name + ' - ' + fps + 'fps');
        }

        if (this.getTime().getElapsedFrames() % 30 == 0) {
            console.log(this.getTime().getFPS().toFixed(2))
            this.fpsLabel.setTitle('FPS: ' + this.getTime().getFPS().toFixed(2));
        }

        this.gui.draw();
    }
})
