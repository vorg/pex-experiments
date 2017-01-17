attribute vec3 aNormal;
attribute vec4 aPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform float uPointSize;
varying vec4 vColor;
void main() {
  vColor = vec4(uNormalMatrix * aNormal * 0.5 + 0.5, 1.0);
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
  gl_PointSize = uPointSize;
}
