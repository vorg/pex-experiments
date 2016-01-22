#ifdef GL_ES
precision highp float;
#endif

varying vec3 ecPosition;
uniform float uNear;
uniform float uFar;

//Z in Normalized Device Coordinates
//http://www.songho.ca/opengl/gl_projectionmatrix.html
float eyeSpaceDepthToNDC(float zEye) {
  float A = -(uFar + uNear) / (uFar - uNear); //projectionMatrix[2].z
  float B = -2.0 * uFar * uNear / (uFar - uNear); //projectionMatrix[3].z; //

  float zNDC = (A * zEye + B) / -zEye;
  return zNDC;
}

//depth buffer encoding
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToDepthBuf(float zNDC) {
  return 0.5 * zNDC + 0.5;
}


void main() {
    float zEye = ecPosition.z;
    float zNDC = eyeSpaceDepthToNDC(zEye);
    float zBuf = ndcDepthToDepthBuf(zNDC);

    gl_FragColor = vec4(zBuf);
}
