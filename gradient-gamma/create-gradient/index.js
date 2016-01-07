var isBrowser = require('is-browser');
var plask = isBrowser ? {} : require('plask');
var d3_interpolate = require('d3-interpolate');
var Color = require('pex-color');

function toLinear(color) {
    color = color.slice(0);
    color[0] = Math.pow(color[0], 2.2);
    color[1] = Math.pow(color[1], 2.2);
    color[2] = Math.pow(color[2], 2.2);
    return color;
}

function toGamma(color) {
    color = color.slice(0);
    color[0] = Math.pow(color[0], 1.0/2.2);
    color[1] = Math.pow(color[1], 1.0/2.2);
    color[2] = Math.pow(color[2], 1.0/2.2);
    return color;
}

function colorGradient(colors, numSteps) {
    var gradient = [];
    //var interpolator = ;
    var numStops = colors.length - 1;
    var stepsPerStop = numSteps / numStops;
    for(var i=0; i<numSteps; i++) {
        var stop = Math.floor(i / stepsPerStop);
        var t = (i / stepsPerStop) - stop;
        var rgba = d3_interpolate.value(colors[stop], colors[stop+1])(t);
        gradient.push(rgba.slice(0));
    }

    return gradient;
}

function colorGradientGamma(colors, numSteps) {
    colors = colors.map(toLinear);
    var gradient = colorGradient(colors, numSteps);
    gradient = gradient.map(toGamma);
    return gradient;
}

function createGradientBrowser(colors, w, h, correctGamma) {
}

function createGradientSkia(colors, w, h, correctGamma) {
    var gradient = correctGamma ? colorGradientGamma(colors, w) : colorGradient(colors, w);

    var canvas = plask.SkCanvas.create(w, h);
    var paint = new plask.SkPaint();
    gradient.forEach(function(color, i) {
        paint.setColor((color[0] * 255) | 0, (color[1] * 255) | 0, (color[2] * 255) | 0, 255);
        canvas.drawRect(paint, i, 0, i+1, h);
    })

    return canvas;
}

function createGradient(colors, w, h, correctGamma) {
    if (isBrowser) {
        return createGradientBrowser(colors, w, h, correctGamma);
    }
    else {
        return createGradientSkia(colors, w, h, correctGamma);
    }
}

module.exports = createGradient;
