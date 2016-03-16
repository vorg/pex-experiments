#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;
uniform sampler2D colorTex;
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

  float pixelDepth = readDepth(vTexCoord);

  float focus = clamp(abs(pixelDepth - depth) / depthRange, 0.0, 1.0);

  float dx = 1.0/1280.0;
  float dy = 1.0/720.0;
  float r = 1.5;

  vec3 color = vec3(0.0);
  float samples = 0;
  for(int x=-3; x<=3; x++) {
      for(int y=-3; y<=3; y++) {
          color += texture2D(colorTex, vTexCoord + vec2(x * dx * focus * r, y * dy * focus * r)).rgb;
          samples += 1.0;
      }
  }
  color /= samples;

  gl_FragColor.rgb = color;

  gl_FragColor.a = 1.0;
}
