attribute vec4 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

//position in eye space coordinates (camera space, view space)
varying vec3 ecPosition;

void main() {
    vec4 ecPos = uViewMatrix * uModelMatrix * aPosition;
    gl_Position = uProjectionMatrix * ecPos;

    ecPosition = ecPos.xyz;
}
