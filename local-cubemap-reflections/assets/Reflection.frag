#ifdef GL_ES
precision highp float;
#endif

uniform mat4 uInverseViewMatrix;
uniform samplerCube uReflectionMap;
uniform vec4 uColor;
uniform float uReflectivity;

varying vec3 ecPosition;
varying vec3 ecNormal;

void main() {
    vec3 ecEyeDir = normalize(-ecPosition);
    vec3 wcEyeDir = vec3(uInverseViewMatrix * vec4(ecEyeDir, 0.0));
    vec3 wcNormal = vec3(uInverseViewMatrix * vec4(ecNormal, 0.0));

    vec3 N = normalize(ecNormal);
    vec3 L = normalize(vec3(10.0, 10.0, 10.0));
    float NdotL = max(0.0, dot(N, L));
    float wrap = 1.0;
    vec4 diffuseColor = vec4(uColor.rgb * (NdotL + wrap)/(1.0 + wrap), 1.0);

    vec3 reflectionWorld = reflect(-wcEyeDir, normalize(wcNormal)); //eye coordinates reflection vector

    vec4 reflectionColor = textureCube(uReflectionMap, reflectionWorld);
    vec4 color = diffuseColor * (1.0 - uReflectivity) + reflectionColor * uReflectivity;

    //gl_FragColor = vec4(ecNormal * 0.5 + 0.5, 1.0);
    gl_FragColor = color;
}
