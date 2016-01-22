#ifdef GL_ES
precision highp float;
#endif

uniform vec4 ambientColor;
uniform vec4 diffuseColor;
uniform vec3 lightPos;
uniform float wrap;
uniform float lightNear;
uniform float lightFar;
uniform sampler2D depthMap;

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

  float bias = 0.01;
  float lightDistDepth = readDepth(depthMap, lightUV);

  //step(edge, x) -> 0 if x < edge, 1 if x > edge
  //pixel is in the shadow if
  //
  //  Eye  distView [|||||||] distDepth <-------- Ligh
  //
  //  "if distDepth is closer that distView then shadow"
  //  "max thickness of the opaque object allowed is 'bias'"
  float illuminated = step(lightDistView, lightDistDepth + bias);

  gl_FragColor = mix(vec4(0.05, 0.05, 0.05, 1.0), vec4(1.0, 1.0, 1.0, 1.0), illuminated);

  gl_FragColor.rgb = toGamma(gl_FragColor.rgb);
}
