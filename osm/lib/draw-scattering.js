const Mat4 = require('pex-math/Mat4')

module.exports = function createDrawSolidColor (regl) {
  return regl({
    attributes: {
      aPosition: (_, props) => props.geom.positions,
      aNormal: (_, props) => props.geom.normals
    },
    // elements: (_, props) => props.geom.cells,
    count: (_, props) => props.geom.positions.length,
    vert: `
    attribute vec3 aPosition;
    // attribute vec3 aNormal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    varying vec3 vNormalView;
    varying vec3 vPositionWorld;

    void main () {
      vec4 positionWorld = uModelMatrix * vec4(aPosition, 1.0);
      gl_Position = uProjectionMatrix * uViewMatrix * positionWorld;
      gl_PointSize = 1.0;
      // vNormalView = aNormal;
      vPositionWorld = positionWorld.xyz;
    }
    `,
      frag: `
      #ifdef GL_ES
      precision highp float;
      #endif

      uniform vec4 uColor;
      uniform vec4 uDiffuseColor;
      uniform vec3 uCameraPos;
      uniform vec3 uLightPos;
      uniform float uScattering;

      // varying vec3 vNormalView;
      varying vec3 vPositionWorld;

      float InScatter(vec3 start, vec3 dir, vec3 lightPos, float d) {
        // calculate quadratic coefficients a,b,c
        vec3 q = start - lightPos;

        float b = dot(dir, q);
        float c = dot(q, q);

        // evaluate integral
        float s = 1.0 / sqrt(c - b*b);

        float l = s * (atan((d + b) * s) - atan(b*s));

        return l;
      }

      void main () {
        // gl_FragColor.rgb = vNormalView * 0.5 + 0.5;

        //direction from camera
        vec3 dir = vPositionWorld - uCameraPos;
        //normalize
        float l = length(dir);
        dir /= l;

        vec3 color = pow(uColor.rgb, vec3(2.2));

        vec3 diffuse = pow(uDiffuseColor.rgb, vec3(2.2));
        vec3 scatter = color + diffuse * pow(vec3(0.2, 0.5, 0.8), vec3(2.2)) * InScatter(uCameraPos, dir, uLightPos, l) * uScattering;

        gl_FragColor.rgb = pow(scatter.rgb, vec3(1.0/2.2));
        gl_FragColor.a = 1.0;
      }
    `,
    primitive: (_, props) => props.primitive,
    uniforms: {
      uColor: (_, props) => props.color,
      uProjectionMatrix: (_, props) => props.camera.projectionMatrix,
      uViewMatrix: (_, props) => props.camera.viewMatrix,
      uModelMatrix: Mat4.create(),
      uDiffuseColor: [0.8, 0.3, 0.7, 1.0],
      uLightPos: (_, props) => [0, 0.0, 0],
      uCameraPos: (_, props) => props.camera.position,
      uScattering: 0.03
    }
  })
}
