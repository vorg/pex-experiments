attribute vec4 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vWorldPosition;


void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition, 1.0;
  vWorldPosition = (uModelMatrix * aPosition).xyz;
  vNormal = uNormalMatrix * aNormal;
}
