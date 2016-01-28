attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec3 aCustom0; //offset
attribute float aCustom1; //scale

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

varying vec3 ecNormal;

void main() {
    vec3 offset = aCustom0;
    float scale = aCustom1;
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition.xyz * scale + offset, 1.0);
    ecNormal = uNormalMatrix * aNormal;
}
