attribute vec4 aPosition;
attribute vec2 aTexCoord0;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

varying vec2 vTexCoord;

void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
    vTexCoord = aTexCoord0;
}
