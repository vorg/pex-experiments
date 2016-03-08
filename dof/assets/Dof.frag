#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;
uniform sampler2D colorTex;
uniform sampler2D blurredTex;
uniform sampler2D depthMap;
uniform float depth;
uniform float depthRange;
uniform float near;
uniform float far;

float readDepth(vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
  return z_e;
}

void main() {
  vec3 color = texture2D(colorTex, vTexCoord).rgb;
  vec3 blurred = texture2D(blurredTex, vTexCoord).rgb;
  float pixelDepth = readDepth(vTexCoord);

  gl_FragColor.rgb = color * 0 + blurred * 1 + depth * 0;

  float focus = clamp(abs(pixelDepth - depth) / depthRange, 0.0, 1.0);

  gl_FragColor.r = focus;

  gl_FragColor.rgb = mix(color, blurred, focus);

  gl_FragColor.a = 1.0;
}
