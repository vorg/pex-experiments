uniform sampler2D texture;
uniform vec2 scale;
uniform vec4 color;
uniform float smoothing;
uniform float offset;

varying vec2 vTexCoord;

#extension GL_OES_standard_derivatives : enable
#pragma glslify: aastep = require('glsl-aastep')

void main() {
    float dist = texture2D(texture, vTexCoord).a;
    float alpha = aastep(0.5, dist);

    if (alpha < 0.01) {
        discard;
    }

    gl_FragColor = vec4(color.rgb, color.a * alpha);
}
