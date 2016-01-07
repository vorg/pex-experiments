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

var Color = {
    toLinear: toLinear,
    toGamma: toGamma
};

module.exports = Color;
