#ifdef GL_ES
precision highp float;
#endif

varying vec3 ecNormal;

uniform vec4 uColor;

void main() {
    vec3 N = normalize(ecNormal);
    vec3 L = normalize(vec3(10.0, 10.0, 10.0));
    float NdotL = max(0.0, dot(N, L));
    float wrap = 1.0;
    vec4 color = vec4(uColor.rgb * (NdotL + wrap)/(1.0 + wrap), 1.0);
    gl_FragData[0] = color;
    gl_FragData[1].rgb = N;
    gl_FragData[1].a = 1.0;
}
