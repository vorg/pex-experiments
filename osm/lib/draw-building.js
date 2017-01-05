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
    attribute vec3 aNormal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    varying vec3 vNormalView;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
      gl_PointSize = 1.0;
      vNormalView = aNormal;
    }
    `,
      frag: `
      #ifdef GL_ES
      precision highp float;
      #endif

      uniform vec4 uColor;
      varying vec3 vNormalView;

      void main () {
        gl_FragColor = uColor;
        gl_FragColor.rgb = vNormalView * 0.5 + 0.5;
      }
    `,
    primitive: (_, props) => props.primitive,
    uniforms: {
      uColor: (_, props) => props.color,
      uProjectionMatrix: (_, props) => props.camera.projectionMatrix,
      uViewMatrix: (_, props) => props.camera.viewMatrix,
      uModelMatrix: Mat4.create()
    }
  })
}
