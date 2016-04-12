attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord0;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

uniform vec3 uLightPosition;

varying vec3 vPositionView;
varying vec3 vNormalView;
varying vec2 vTexCoord0;
varying vec3 vLightPositionView;

void main() {
    vec4 positionView = uViewMatrix * uModelMatrix * aPosition;
    vPositionView = vec3(positionView);

    gl_Position = uProjectionMatrix * positionView;

    vNormalView = vec3(uNormalMatrix * aNormal);

    vTexCoord0 = aTexCoord0;

    //proper way
    vLightPositionView = vec3(uViewMatrix * vec4(uLightPosition, 1.0));

    //instead let's assume the light in view space so we get responsive lighting when we move arcball
    vLightPositionView = uLightPosition;
}
