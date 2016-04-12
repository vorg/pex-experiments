#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: toLinear = require('glsl-gamma/in')
#pragma glslify: toGamma = require('glsl-gamma/out')
#pragma glslify: blinnPhongSpec = require(glsl-specular-blinn-phong)

varying vec3 vPositionView;
varying vec3 vNormalView;
varying vec2 vTexCoord0;
varying vec3 vLightPositionView;

uniform sampler2D uBaseColorTex;

void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(-vPositionView);
    vec3 L = normalize(vLightPositionView - vPositionView);
    vec3 H = normalize((V + L) / 2.0);
    float NdotL = max(0.0, dot(N, L));
    float VdotH = max(0.0, dot(H, V));

    //fresnel
    float F0 = 0.04;
    float F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
    float specular = F * blinnPhongSpec(L, V, N, 32.0);

    vec3 baseColor = toLinear(texture2D(uBaseColorTex, vTexCoord0).rgb);
    gl_FragColor.rgb = NdotL * baseColor * (1.0 - specular) + specular;
    gl_FragColor.rgb = toGamma(gl_FragColor.rgb);
    gl_FragColor.a = 1.0;
}
