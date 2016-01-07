var isBrowser = require('is-browser');
var plask = isBrowser ? {} : require('plask');
var Color = require('pex-color');
var lerp = require('lerp-array');

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

function gradientInterpolate(colors, t) {
    var numStops = colors.length - 1;
    var stopF = t * numStops;
    var stop = Math.floor(stopF);
    var k = stopF - stop;
    return lerp(colors[stop], colors[stop+1], k);
}

function series(n) {
    var result = [];
    for(var i=0; i<n; i++) {
        result.push(i);
    }
    return result;
}

function colorGradient(colors, numSteps) {
    return series(numSteps).map(function(i) {
        return gradientInterpolate(colors, i/numSteps);
    })
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
