//adapted from ThreeJS
//https://github.com/mrdoob/three.js/blob/8e2d3a8cbc8a7b85db9070b443ad4cd27c248f6f/examples/js/controls/DeviceOrientationControls.js

var Vec3 = require('pex-math/Vec3');
var Quat = require('pex-math/Quat');
var toRadians = require('pex-math/Utils').toRadians;

var degToRad = Math.PI / 180; // Degree-to-Radian conversion

var isBrowser = typeof(window) != 'undefined';

var DeviceOrientation = {
  rotation: Quat.create(),
  enabled: true,
  deviceOrientation: {},
  screenOrientation: isBrowser ? (window.orientation || 0) : 0
};

var onDeviceOrientationChange = function(event) {
  DeviceOrientation.deviceOrientation = event;
};

var onScreenOrientationChange = function() {
  DeviceOrientation.screenOrientation = window.orientation || 0;
};


DeviceOrientation.connect = function() {
  if (isBrowser) {
    window.addEventListener( 'orientationchange', onScreenOrientationChange, false );
    window.addEventListener( 'deviceorientation', onDeviceOrientationChange, false );
  }
  DeviceOrientation.enabled = true;
}

DeviceOrientation.disconnect = function() {
  if (isBrowser) {
    window.removeEventListener( 'orientationchange', onScreenOrientationChange, false );
    window.removeEventListener( 'deviceorientation', onDeviceOrientationChange, false );
  }
  DeviceOrientation.enabled = false;
}


// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

var setObjectQuaternion = function() {
  var zee = [0, 0, 1];

  //var euler = new THREE.Euler();

  var q0 = Quat.create();
  var qx = Quat.create();
  var qy = Quat.create();
  var qz = Quat.create();

  var q1 = Quat.set4(Quat.create(), - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

  return function ( quaternion, alpha, beta, gamma, orient ) {

    Quat.setAxisAngle(qx, beta, [1, 0, 0]);
    Quat.setAxisAngle(qy, alpha, [0, 1, 0]);
    Quat.setAxisAngle(qz, -gamma, [0, 0, 1]);
    //euler.set( beta, alpha, - gamma, 'YXZ' );                       // 'ZXY' for the device, but 'YXZ' for us

    //var euler = {
    //  _x : beta,
    //  _y : alpha,
    //  _z : -gamma
    //}
//
    //var c1 = Math.cos( euler._x / 2 );
    //var c2 = Math.cos( euler._y / 2 );
    //var c3 = Math.cos( euler._z / 2 );
    //var s1 = Math.sin( euler._x / 2 );
    //var s2 = Math.sin( euler._y / 2 );
    //var s3 = Math.sin( euler._z / 2 );
//
    //if ( euler.order === 'XYZ' ) {
//
    //  this._x = s1 * c2 * c3 + c1 * s2 * s3;
    //  this._y = c1 * s2 * c3 - s1 * c2 * s3;
    //  this._z = c1 * c2 * s3 + s1 * s2 * c3;
    //  this._w = c1 * c2 * c3 - s1 * s2 * s3;

    //else if ( euler.order === 'YXZ' ) {
//
    //  this._x = s1 * c2 * c3 + c1 * s2 * s3;
    //  this._y = c1 * s2 * c3 - s1 * c2 * s3;
    //  this._z = c1 * c2 * s3 - s1 * s2 * c3;
    //  this._w = c1 * c2 * c3 + s1 * s2 * s3;
//
    //} else if ( euler.order === 'ZXY' ) {

    Quat.identity(quaternion);
    Quat.mult(quaternion, qy)
    Quat.mult(quaternion, qx)
    Quat.mult(quaternion, qz)
    //quaternion.identity().mul(qy).mul(qx).mul(qz); //YXZ
    //quaternion.identity().mul(qz).mul(qx).mul(qy); //YXZ

    //quaternion.setFromEuler( euler );                               // orient the device

    Quat.mult(quaternion, q1)
    //quaternion.mul( q1 );                                      // camera looks out the back of the device, not the top

    Quat.setAxisAngle(q0, -orient, zee )
    Quat.mult(quaternion,  q0);    // adjust for screen orientation

    //if (alpha == gamma == beta == 0) {
    //  quaternion.identity();
    //}

  }

}();

DeviceOrientation.update = function() {
  if ( DeviceOrientation.enabled === false ) return;

  var alpha  = DeviceOrientation.deviceOrientation.alpha ? ( degToRad * DeviceOrientation.deviceOrientation.alpha ) : 0; // Z
  var beta   = DeviceOrientation.deviceOrientation.beta  ? ( degToRad * DeviceOrientation.deviceOrientation.beta  ) : 0; // X'
  var gamma  = DeviceOrientation.deviceOrientation.gamma ? ( degToRad * DeviceOrientation.deviceOrientation.gamma ) : 0; // Y''
  var orient = DeviceOrientation.screenOrientation       ? ( degToRad * DeviceOrientation.screenOrientation       ) : 0; // O

  setObjectQuaternion( DeviceOrientation.rotation, alpha, beta, gamma, orient );
};

DeviceOrientation.connect();

module.exports = DeviceOrientation;
