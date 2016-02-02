var Window          = require('pex-sys/Window')
var PerspCamera     = require('pex-cam/PerspCamera')
var Arcball         = require('pex-cam/Arcball')
var createCube      = require('primitive-cube')
var glslify         = require('glslify-promise')
var isBrowser       = require('is-browser')
var random          = require('pex-random')

Window.create({
    settings: {
        width:  1280,
        height: 720,
        type: '2d'
    },
    init: function() {
        var ctx = this.getContext()
        ctx.strokeStyle = '#777'
        var w = this.getWidth()
        var h = this.getHeight()

        ctx.fillStyle = '#EEE'
        ctx.fillRect(0, 0, w, h)

        var MAX_DEPTH = 10
        var rect = [10, 10, w-20, h-20, 0] //x, y, w, h, depth

        function divide(parent, rects) {
            rects.push(parent);

            var depth = parent[4]

            var shouldDivide = random.chance(1/(depth+1));
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
                divide(child, rects)
            }
            return rects
        }

        var rects = divide(rect, [])
        console.log(rects.length)

        ctx.strokeStyle = '#666'
        rects.map(function(rect) {
            ctx.strokeRect(rect[0], rect[1], rect[2], rect[3])
            ctx.fillStyle = 'rgba(255,0,0,0.2)'
            ctx.fillRect(rect[0], rect[1], rect[2], rect[3])
        })

    },
    draw: function() {

    }
})
