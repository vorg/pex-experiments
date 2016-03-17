#ifdef GL_ES
precision highp float;
#endif

uniform mat4 uInverseViewMatrix;
uniform samplerCube uReflectionMap;
uniform vec4 uColor;
uniform float uReflectivity;
uniform vec3 uBBoxMin;
uniform vec3 uBBoxMax;
uniform vec3 uCubeMapPos;

varying vec3 ecPosition;
varying vec3 ecNormal;

//http://gamasutra.com/blogs/RobertoLopezMendez/20160115/263574/Reflections_Based_on_Local_Cubemaps_in_Unity.php
vec3 localCorrect(vec3 origVec, vec3 bboxMin, vec3 bboxMax, vec3 vertexPos, vec3 cubemapPos) {
    // Find the ray intersection with box plane
    vec3 invOrigVec = vec3(1.0,1.0,1.0)/origVec;
    vec3 intersecAtMaxPlane = (bboxMax - vertexPos) * invOrigVec;
    vec3 intersecAtMinPlane = (bboxMin - vertexPos) * invOrigVec;
    // Get the largest intersection values
    // (we are not intersted in negative values)
    vec3 largestIntersec = max(intersecAtMaxPlane, intersecAtMinPlane);
    // Get the closest of all solutions
    float Distance = min(min(largestIntersec.x, largestIntersec.y),
                         largestIntersec.z);
    // Get the intersection position
    vec3 IntersectPositionWS = vertexPos + origVec * Distance;
    // Get corrected vector
    vec3 localCorrectedVec = IntersectPositionWS - cubemapPos;
    return localCorrectedVec;
}

void main() {
    vec3 ecEyeDir = normalize(-ecPosition);
    vec3 wcPosition = vec3(uInverseViewMatrix * vec4(ecPosition, 1.0));
    vec3 wcEyeDir = vec3(uInverseViewMatrix * vec4(ecEyeDir, 0.0));
    vec3 wcNormal = vec3(uInverseViewMatrix * vec4(ecNormal, 0.0));

    vec3 N = normalize(ecNormal);
    vec3 L = normalize(vec3(10.0, 10.0, 10.0));
    float NdotL = max(0.0, dot(N, L));
    float wrap = 1.0;
    vec4 diffuseColor = vec4(uColor.rgb * (NdotL + wrap)/(1.0 + wrap), 1.0);

    vec3 reflectionWorld = reflect(-wcEyeDir, normalize(wcNormal)); //eye coordinates reflection vector

    vec3 localCorrReflDirWS = localCorrect(reflectionWorld, uBBoxMin,
                                 uBBoxMax, wcPosition,
                                 uCubeMapPos);

    vec4 reflectionColor = textureCube(uReflectionMap, localCorrReflDirWS);
    vec4 color = diffuseColor * (1.0 - uReflectivity) + reflectionColor * uReflectivity;

    //gl_FragColor = vec4(ecNormal * 0.5 + 0.5, 1.0);
    gl_FragColor = color;
}
