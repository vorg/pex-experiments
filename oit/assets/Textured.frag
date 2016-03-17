#ifdef GL_ES
precision highp float;
#extension GL_EXT_draw_buffers : require
#endif

varying vec2 vTexCoord0;
varying vec3 ecNormal;
uniform sampler2D uTexture;

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);

  vec3 N = normalize(ecNormal);
  vec3 L = normalize(vec3(10.0, 10.0, 10.0));
  float NdotL = max(0.0, dot(N, L));
  float wrap = 1.0;
  color.rgb *= (NdotL + wrap)/(1.0 + wrap);
  color.a = 1.0;

  gl_FragData[0] = color;
  gl_FragData[1].rgb = N;
  gl_FragData[1].a = 1.0;
}
