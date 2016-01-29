attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec3 aCustom0; //offset
attribute vec3 aCustom1; //prevOffset
attribute float aCustom2; //scale
attribute vec4 aCustom3; //color

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

varying vec3 ecNormal;

mat4 transpose(mat4 m) {
  return mat4(
    m[0][0], m[1][0], m[2][0], m[3][0],
    m[0][1], m[1][1], m[2][1], m[3][1],
    m[0][2], m[1][2], m[2][2], m[3][2],
    m[0][3], m[1][3], m[2][3], m[3][3]
  );
}

mat4 quatToMat4(vec4 q) {
    float xs = q.x + q.x;
    float ys = q.y + q.y;
    float zs = q.z + q.z;
    float wx = q.w * xs;
    float wy = q.w * ys;
    float wz = q.w * zs;
    float xx = q.x * xs;
    float xy = q.x * ys;
    float xz = q.x * zs;
    float yy = q.y * ys;
    float yz = q.y * zs;
    float zz = q.z * zs;
    return transpose(
        mat4(
            1.0 - (yy + zz), xy - wz, xz + wy, 0.0,
            xy + wz, 1.0 - (xx + zz), yz - wx, 0.0,
            xz - wy, yz + wx, 1.0 - (xx + yy), 0.0,
            0.0, 0.0, 0.0, 1.0
        )
    );
}

vec4 quatFromDirection(vec3 v) {
  vec3 dir = normalize(v);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = cross(up, dir);

  //if (length(right) < 0.00001) {
  //  up = vec3(1.0, 0.0, 0.0);
  //  right = cross(up, dir);
  //}

  up = cross(dir, right);
  right = normalize(right);
  up = normalize(up);

  mat4 m = mat4(vec4(right, 0.0), vec4(up, 0.0), vec4(dir, 0.0), vec4(0.0, 0.0, 0.0, 1.0));

  float w2 = 1.0 + m[0][0] + m[1][1] + m[2][2];
  float w;
  if (w2 < 0.001) {
    w = 0.0;
  }
  else {
    w = sqrt(w2) / 2.0;
  }

  float dfWScale = w * 4.0;

  float x = ((m[1][2] - m[2][1]) / dfWScale);
  float y = ((m[2][0] - m[0][2]) / dfWScale);
  float z = ((m[0][1] - m[1][0]) / dfWScale);

  return vec4(x, y, z, w);
}

void main() {
    vec3 offset = aCustom0;
    vec3 prevOffset = aCustom1;
    float scale = aCustom2;
    vec4 color = aCustom3;

    vec3 dir = offset.xyz - prevOffset.xyz;
    if (length(dir) == 0.0) {
        dir = vec3(-1.0, 0.0, 0.0);
    }
    mat4 rot = quatToMat4(quatFromDirection(dir));

    vec4 pos = aPosition;
    pos = rot * pos;
    pos.xyz *= scale;
    pos.xyz += offset;

    vec3 vWorldPosition = vec3(uModelMatrix * pos);

    gl_Position = uProjectionMatrix * uViewMatrix * vec4(vWorldPosition, 1.0);

    ecNormal = uNormalMatrix * aNormal;
}
