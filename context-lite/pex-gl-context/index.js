var isBrowser = require('is-browser');
var plask = isBrowser ? {} : require('plask');

function createContextBrowser(options, draw) {
    var canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    var gl = canvas.getContext('webgl');

    console.log(document.body)
    document.body.appendChild(canvas);

    function rafDraw() {
        draw(gl);
        requestAnimationFrame(rafDraw);
    }

    requestAnimationFrame(rafDraw)
}

function createContextPlask(options, draw) {
    plask.simpleWindow({
        settings: {
            width: options.width,
            height: options.height,
            type: '3d'
        },
        init: function() {

        },
        draw: function() {
            var gl = this.gl;

            console.log('GL' + gl)

            draw(gl);
        }
    })
}

function createContext(options, draw) {
    isBrowser ? createContextBrowser(options, draw) : createContextPlask(options, draw);
}

module.exports = createContext;
