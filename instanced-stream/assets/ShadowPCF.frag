#ifdef GL_ES
precision highp float;
#endif

uniform vec4 ambientColor;
uniform vec4 diffuseColor;
uniform vec3 lightPos;
uniform float wrap;
uniform float lightNear;
uniform float lightFar;
uniform float bias;
uniform sampler2D depthMap;
uniform vec2 depthMapSize;

varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform mat4 lightProjectionMatrix;
uniform mat4 lightViewMatrix;


#pragma glslify: toLinear=require(glsl-gamma/in)
#pragma glslify: toGamma=require(glsl-gamma/out)

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToEyeSpace(float ndcDepth) {
  return 2.0 * lightNear * lightFar / (lightFar + lightNear - ndcDepth * (lightFar - lightNear));
}

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float readDepth(sampler2D depthMap, vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  return ndcDepthToEyeSpace(z_n);
}

float texture2DCompare(sampler2D depthMap, vec2 uv, float compare) {
    float depth = readDepth(depthMap, uv);
    return step(compare, depth);
}

float PCF(sampler2D depths, vec2 size, vec2 uv, float compare){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/size;
            result += texture2DCompare(depths, uv+off, compare);
        }
    }
    return result/25.0;
}

void main() {
  vec3 L = normalize(lightPos);
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, (dot(N, L) + wrap) / (1.0 + wrap));
  vec3 ambient = toLinear(ambientColor.rgb);
  vec3 diffuse = toLinear(diffuseColor.rgb);
  gl_FragColor.rgb = ambient + NdotL * diffuse;

  vec4 lightViewPosition = lightViewMatrix * vec4(vWorldPosition, 1.0);
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = lightProjectionMatrix * lightViewPosition;
  vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = PCF(depthMap, depthMapSize, lightUV, lightDistView - bias);

  gl_FragColor = mix(vec4(0.05, 0.05, 0.05, 1.0), vec4(1.0, 1.0, 1.0, 1.0), illuminated);

  gl_FragColor.rgb = toGamma(gl_FragColor.rgb);
}
