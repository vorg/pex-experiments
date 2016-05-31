var random = require('pex-random')

var MAX_PARAMS_SIZE = 8

var LOP_NONE	 = 0
var LOP_ADD		 = 1
var LOP_MUL		 = 2
var LOP_MIN		 = 3
var LOP_MAX		 = 4
//var LOP_ADD_WRAP = 5 //NOT IMPLEMENTED
//var LOP_DIF_WRAP = 6 //NOT IMPLEMENTED

var FFID_Root 			= 999
var FFID_None			= 0

var FFID_Checker		= 1
var FFID_Envmap			= 2
var FFID_Subplasma		= 3
var FFID_PerlinNoise	= 4
var FFID_Cells			= 5
var FFID_Gradient 		= 6
var FFID_Plasma			= 7
var FFID_Flare			= 8

var FFID_Colorize		= 11
var FFID_Emboss			= 12
var FFID_BrightnessContrast = 13
var FFID_Threshold		= 14

var FFID_MixMap			= 21
var FFID_LayerOperator  = 22

var FFID_Sinus			= 31
var FFID_Twirl			= 32
var FFID_DistortMap		= 33
var FFID_Offset			= 34

var FilterNameMap = {
    999:'Root',
    0:'None',
    1:'Checker',
    2:'Envmap',
    3:'Subplasma',
    4:'PerlinNoise',
    5:'Cells',
    6:'Gradient',
    7:'Plasma',
    8:'Flare',
    11:'Colorize',
    12:'Emboss',
    13:'BrightnessContrast',
    14:'Threshold',
    21:'MixMap',
    22:'LayerOperator',
    31:'Sinus',
    32:'Twirl',
    33:'DistortMap',
    34:'Offset'
}


var CT_CELLS_1 = 0, CT_CELLS_2 = 1,
    CT_PARTICLES_1 = 2, CT_PARTICLES_2 = 3,
    CT_DIAMOND_1 = 4, CT_DIAMOND_2 = 5, CT_DIAMOND_3 = 6,
    CT_MUU = 7

var FM_RAYS = 0,
	FM_SMALL_HALO = 1, FM_BIG_HALO = 2,
    FM_GLOW = 3,
    FM_RING = 4

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max))
}

function nop() {
}

function memcopy(dst, src, length) {
    for(var i=0; i<length; i++) {
        dst[i] = src[i];
    }
}

function memset(array, val, length) {
    for(var i=0; i<length; i++) {
        array[i] = val;
    }
}

// Variant of a Lehman Generator 
var lcg = (function() {
  // Set to values from http://en.wikipedia.org/wiki/Numerical_Recipes
      // m is basically chosen to be large (as it is the max period)
      // and for its relationships to a and c
  var m = 4294967296,
      // a - 1 should be divisible by m's prime factors
      a = 1664525,
      // c and m should be co-prime
      c = 1013904223,
      seed, z;
  return {
    setSeed : function(val) {
      z = seed = val || Math.round(Math.random() * m);
    },
    getSeed : function() {
      return seed;
    },
    rand : function() {
      // define the recurrence relationship
      z = (a * z + c) % m;
      // return a float in [0, 1) 
      // if z = m then z / m = 0 therefore (z % m) / m < 1 always
      return z / m;
    }
  };
}());

lcg.setSeed(5)

//FIXME: this doesn't work
function floatNoise(x) {
    return lcg.rand();

    //too slow
    //random.seed(x)
    //return random.float()
    
    //overflows int
    //x = (x<<13 | 0) ^ x;
    //return ( (x * (x * x * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648.0;
}

function smoothstep(a, b, x)
{
	if (x<a) return 0;
    else if (x>=b) return 1;
    else {
   	    x = (x-a) / (b-a);
   		return (x*x) * (3-2*x);
    }
}

function rotatePixels(pixels) {
    for(var x=0; x<256; x++) {
        for(var y=x+1; y<256; y++) {
            for(var i=0; i<3; i++) {
                var c = pixels[(x + 256 * y) * 3 + i]
                pixels[(x + 256 * y) * 3 + i] = pixels[(y + 256 * x) * 3 + i]
                pixels[(y + 256 * x) * 3 + i] = c
            }
        }
    }
}

//------------------------------------------------------------------------------

var STEPS = 10;   //ilosc krokow na segment
var TIGHTNESS = 0.5; // const // dla 0.5 mamy Catmull-Rom Spline

//1d
function cardinalSpline(p0, p1, p2, p3, x) {
 	var x2 = x * x;
 	var x3 = x * x2;
 	var h1 = 2*x3 - 3*x2 + 1;
 	var h2 = -2*x3 + 3*x2;
 	var h3 = x3 - 2*x2 + x;
 	var h4 = x3 - x2;
 	var t1 = (p2 - p0) * TIGHTNESS;
 	var t2 = (p3 - p1) * TIGHTNESS;

 	return p1*h1 + p2*h2 + t1*h3 + t2*h4;
}


//------------------------------------------------------------------------------
function cardinalSpline3(v0, v1, v2, v3, x) {
	return [
        cardinalSpline(v0[0], v1[0], v2[0], v3[0], x),
	    cardinalSpline(v0[1], v1[1], v2[1], v3[1], x),
	    cardinalSpline(v0[2], v1[2], v2[2], v3[2], x)
    ]
}

//------------------------------------------------------------------------------
// TODO : jeju, zoptymalizowac to
//
// plasma dodaje sie do tego co jest dlatego zakladam ze warstwa jest 
// pusta, ew. zawiera poprzednie iteracje perlinNois'a
//
// PARAMS   0 - blending mode
//			1 - freq
//			2 - ampitude
//			3 - random seed 1
//			4 - random seed 2
// 			5 - add - //jezeli ustawione na 0 - to tekstura jest najpierw czyszczona
//				      //wstawienie tu jedynki pozwala kumulowac kolejne iteracje
function subplasma(fd) {
	var freq = (fd.params[1]) ? (fd.params[1]) : (19);
    var amp = (fd.params[2]) ? (fd.params[2]) : (255);
	var randomSeed = fd.params[3];
	var randomSeed2 = fd.params[4];
	var x, y;

    if (!fd.params[5]) {
    	memset(fd.pixels, 0, fd.width * fd.height * fd.nchannels);
    }

	//var ch = fd.nchannels;
	//var w = fd.width;
	//var h = fd.height;
	var value;
	var f;
	for (y = 0; y < 256; y+=freq) {
		for (x = 0; x < 256; x+=freq) {
			f = floatNoise(y+x*x + randomSeed*256 + randomSeed2);
			value = (amp * f*f) | 0;
			fd.pixels[(x + 256 * y) * 3 + 0] = Math.min(255, fd.pixels[(x + 256 * y) * 3 + 0] + value);
			fd.pixels[(x + 256 * y) * 3 + 1] = Math.min(255, fd.pixels[(x + 256 * y) * 3 + 1] + value);
			fd.pixels[(x + 256 * y) * 3 + 2] = Math.min(255, fd.pixels[(x + 256 * y) * 3 + 2] + value);
		}
	}

    //return

	var i;
	for (y = 0; y < 256; y+=freq) {
		for (x = 0; x < 256; x++) {
			//if (x % freq == 0) { continue; }
			i = x-(x%freq);
			value = cardinalSpline(fd.pixels[((i?i:256)-freq + 256 * y) * 3 + 0],
									fd.pixels[(i + 256 * y) * 3 + 0],
									fd.pixels[((i+freq)%256 + 256 * y) * 3 + 0],
									fd.pixels[((i+2*freq)%256 + 256 * y) * 3 + 0],
									(x % freq) / (freq));
			value = clamp(value, 0, 255);
			fd.pixels[(x + 256 * y) * 3 + 0] = value;
			fd.pixels[(x + 256 * y) * 3 + 1] = value;
			fd.pixels[(x + 256 * y) * 3 + 2] = value;
		}
	}

	for (y = 0; y < 256; y++) {
		if (y % freq == 0) { continue; }  //pomijamy wyliczone juz punkty
		for (x = 0; x < 256; x++) {
			i = y-(y%freq); //zaokraglamy na najblizszej mniejszej liczby calkowietej
			value = cardinalSpline(fd.pixels[(x + 256 * ((i?i:256)-freq)) * 3 + 0],
									fd.pixels[(x + 256 * i) * 3 + 0],
									fd.pixels[(x + 256 * ((i+freq)%256)) * 3 + 0],
									fd.pixels[(x + 256 * ((i+2*freq)%256)) * 3 + 0],
									(y % freq) / (freq));
			value = clamp(value, 0, 255);
			fd.pixels[(x + 256 * y) * 3 + 0] = value;
			fd.pixels[(x + 256 * y) * 3 + 1] = value;
			fd.pixels[(x + 256 * y) * 3 + 2] = value;
		}
	}
}

//------------------------------------------------------------------------------
// sinus - znieksztalcanie sinusoida
//
// PARAMS   0 - Num of X-sines
// 			1 - Num of X-sines
// 			2 - X-amplitude", 
// 			3 - Y-amplitude", 
// 			4 - X-shift", Para
// 			5 - Y-shift", Para

function sinus(fd) {
	if (fd.nSrcs!=1)
    	return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
    var sx;
    var sy;
    var numX = fd.params[0];
    var numY = fd.params[1];
    var ampX = fd.params[2];
    var ampY = fd.params[3];
    var shiftX = fd.params[4];
    var shiftY = fd.params[5];

   	for (var y = 0; y < 256; y++) {
		for (var x = 0; x < 256; x++) {
           	sx = shiftX + x  + ampX*Math.sin((numX*Math.PI*y)/256);
            if (sx<0) sx = 255 - (-sx)%255;
            else if (sx>255) sx %=256;
           	sy = shiftY + y  + ampY*Math.sin((numY*Math.PI*x)/256);
            if (sy<0) sy = 255 - (-sy)%255;
            else if (sy>255) sy %=256;

            sx = sx | 0
            sy = sy | 0

			fd.pixels[(x + 256 * y) * 3 + 0] = src.pixels[(sx + 256 * sy) * 3 + 0];
            fd.pixels[(x + 256 * y) * 3 + 1] = src.pixels[(sx + 256 * sy) * 3 + 1];
            fd.pixels[(x + 256 * y) * 3 + 2] = src.pixels[(sx + 256 * sy) * 3 + 2];
		}
	}
}

//------------------------------------------------------------------------------
// twirl - spiralka
//
// PARAMS   0 - Amount

function twirl(fd) {
	if (fd.nSrcs!=1)
    	return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
	var r = 128;
	var d;
    var nx, ny;
    var a = 6*Math.PI*((fd.params[0]-128)/256.0);
	for (var y = 0; y < 256; y++)
		for (var x = 0; x < 256; x++) {
			d = Math.sqrt((x-128)*(x-128)+(y-128)*(y-128));
			if (d<=r) {
            	d = (r-d)/r;
	            nx = (x-128)*Math.cos(d*a)-(y-128)*Math.sin(d*a) + 128;
    	        ny = (x-128)*Math.sin(d*a)+(y-128)*Math.cos(d*a) + 128;
				clamp(nx,0,255);
				clamp(ny,0,255);
            }
            else {
            	nx = x;
                ny = y;
            }
            nx = nx | 0
            ny = ny | 0
			fd.pixels[(x + 256 * y) * 3 + 0] = src.pixels[(nx + 256 * ny) * 3 +0];
			fd.pixels[(x + 256 * y) * 3 + 1] = src.pixels[(nx + 256 * ny) * 3 +1];
			fd.pixels[(x + 256 * y) * 3 + 2] = src.pixels[(nx + 256 * ny) * 3 +2];
        }
}

//------------------------------------------------------------------------------
function offset(fd) {
	if (fd.nSrcs!=1)
    	return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }

    var src = fd.sources[0];
    var dx = fd.params[0];
    var dy = fd.params[1];
    var nx;
    var ny;
    for (var x = 0; x<256; x++) {
        nx = (x+dy)%fd.width;
	    for (var y = 0; y<256; y++) {
	        ny = (y+dx)%fd.height;
           	fd.pixels[(x + 256 * y) * 3 + 0] = src.pixels[(nx + 256 * ny) * 3 + 0];
           	fd.pixels[(x + 256 * y) * 3 + 1] = src.pixels[(nx + 256 * ny) * 3 + 1];
           	fd.pixels[(x + 256 * y) * 3 + 2] = src.pixels[(nx + 256 * ny) * 3 + 2];
        }
    }
}


//------------------------------------------------------------------------------
function distortMap(fd) {
	if (fd.nSrcs!=3)
    	return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
    var xmap = fd.sources[1];
    var ymap = fd.sources[2];
    var ampX = fd.params[0];
    var ampY = fd.params[1];
    var nx, ny;
    var k = 1/255.0;

    for (var x = 0; x<256; x++)
	    for (var y = 0; y<256; y++)
            for (var c = 0; c<3; c++) {
		        if (xmap) {
                    nx = y + ampX * xmap.pixels[(x + 256 * y) * 3 + c]*k;
                    if (nx > 255) nx -= 255;
                }
                else nx = y;
                if (ymap) {
                    ny = x + ampY * ymap.pixels[(x + 256 * y) * 3 + c]*k;
                    if (ny > 255) ny -= 255;
                }
                else ny = x;
                nx = nx | 0
                ny = ny | 0
                fd.pixels[(x + 256 * y) * 3 + c] = src.pixels[(ny + 256 * nx) * 3 + c]; //TODO: really swap nx, ny?
            }
}
//------------------------------------------------------------------------------
// emboss
//
// PARAMS   0 - color1.r
//
// INPUT	0 - src
function emboss(fd)
{
    if (fd.nSrcs != 1) return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
    var mode = fd.params[0];
	var emboss_w = 3;
    var emboss_h = 3;
    var emobss_filter = [ [-1,0,1], [-1,0,1] , [-1,0,1] ];

  	var x, y;
   	var sum = [0,0,0];
    var e, k, pix;

    for(var p=0; p<4; p++)
    for(x=0; x<256; x++)
        for(y=0; y<256; y++) {
        	if (x!=0 && y!=0 && x!=255 && x!=255) {
	        	sum[0] = sum[1] = sum[2] = 0;
    	    	for(var i=0;i<emboss_w;i++)
	    	    	for(var j=0;j<emboss_h;j++) {
            	    	e = emobss_filter[i][j];
                    	pix = (x-((emboss_w-1)>>1)+i + 256 * (y-((emboss_h-1)>>1)+j))*3;
                	    for(k=0;k<3;k++) {
                            sum[k] += e * src.pixels[pix + k];
                        }
	                }

    	        for(k=0;k<3;k++) {
               	    sum[k] += 128;
					if (sum[k]>255) sum[k] = 255;
	            	else if (sum[k]<0) sum[k] = 0;
    	            if (mode == 0) //emboss
        	        	fd.pixels[(x + 256 * y) * 3 + k] = sum[k];
            	    else //bump
	            	    fd.pixels[(x + 256 * y) * 3 + k] = Math.min((src.pixels[(x + 256 * y) * 3 + k]*sum[k])/128, 255);
                }
            }
        }

	for(x=0; x<256; x++)
        for(y=0; y<256; y++)
			for(k=0;k<3;k++) {
				if (x==0) fd.pixels[(x + 256 * y) * 3 + k] = fd.pixels[(x+1 + 256 * y) * 3 + k];
                else if (x==255) fd.pixels[(x + 256 * y) * 3 + k] = fd.pixels[(x-1 + 256 * y) * 3 + k];
				else if (y==0) fd.pixels[(x + 256 * y) * 3 + k] = fd.pixels[(x + 256 * (y+1)) * 3 + k];
				else if (y==255) fd.pixels[(x + 256 * y) * 3 + k] = fd.pixels[(x + 256 * (y-1)) * 3 + k];
            }
}

//------------------------------------------------------------------------------
// colorize
//
// PARAMS   0 - color1.r
//			1 - color1.g
//			2 - color1.b
//			3 - color2.r
//			4 - color2.g
//			5 - color2.b
//
// INPUT	0 - src
function colorize(fd)
{
	if (fd.nSrcs != 1) return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];

	var r = fd.params[0];
	var g = fd.params[1];
	var b = fd.params[2];
	var dr = (fd.params[3]-r);
	var dg = (fd.params[4]-g);
	var db = (fd.params[5]-b);

	for (var y = 0; y < 256; y++) {
		for (var x = 0; x < 256; x++) {
			fd.pixels[(x + 256 * y) * 3 + 0] = r + (src.pixels[(x + 256 * y) * 3 + 0]/255.0)*dr;
			fd.pixels[(x + 256 * y) * 3 + 1] = g + (src.pixels[(x + 256 * y) * 3 + 1]/255.0)*dg;
			fd.pixels[(x + 256 * y) * 3 + 2] = b + (src.pixels[(x + 256 * y) * 3 + 2]/255.0)*db;
		}
	}
}


//------------------------------------------------------------------------------
// cells

var cells_numPoints;
var firstDistBuffer = makeArray(256 * 256);
var secondDistBuffer = makeArray(256 * 256);
var cells_xcoords = makeArray(100);
var cells_ycoords = makeArray(100);

//TODO: zoptymalizowac to (jakies drzewo czy cos)
function cells_distanceToNearestPoint(x, y, result, useSqrt) {
    if (useSqrt === undefined) useSqrt = true;
    result.first = 999999.0;
    result.second = 999999.0;
    var dist;
    var dx, dy;
    var px, py;
    for(var i=0; i<cells_numPoints; i++) {
    	px = cells_xcoords[i];
        py = cells_ycoords[i];
        dx = Math.abs(x-px);
    	dy = Math.abs(y-py);
		if (dx > 256/2) dx = 256-dx;
	    if (dy > 256/2) dy = 256-dy;
        if (useSqrt) dist = Math.sqrt( dx*dx + dy*dy );
        else dist = ( dx*dx + dy*dy );
        if (dist < result.first)  {
        	result.second = result.first;        
        	result.first = dist;
    	}
        else if (dist < result.second) result.second = dist;
    }
}


//
// PARAMS   0 - blending mode
//			1 - type
//			2 - num of points (1-100)
//			3 - random seed

function cells(fd)
{
    cells_numPoints = Math.min(fd.params[2], 100);


    var mindist = 999999;
	var maxdist = 0;

    var randomSeed = fd.params[3];
    var mode = fd.params[1];

    var i;
    for(i=0; i<cells_numPoints; i++) {
     	cells_xcoords[i] = 255*floatNoise(i + randomSeed*cells_numPoints + cells_numPoints);
     	cells_ycoords[i] = 255*floatNoise((i + randomSeed*cells_numPoints + cells_numPoints) + i);
    }

    var dist = {
        first: 0,
        second: 0
    }
    var x,y;
    for(x=0; x<256; x++)
	    for(y=0; y<256; y++) {
        	if ((mode == CT_PARTICLES_2) ||
            	(mode == CT_DIAMOND_3))
				cells_distanceToNearestPoint(x, y, dist, false);
            else cells_distanceToNearestPoint(x, y, dist, true);
			if (dist.first < mindist) mindist = dist.first;
		    if (dist.second > maxdist) maxdist = dist.second;
            firstDistBuffer[x + 256 * y] = dist.first;
           	secondDistBuffer[x + 256 * y] = dist.second;
        }


    var c, c2;
    for(x=0; x<256; x++)
	    for(y=0; y<256; y++) {
			c = (255*firstDistBuffer[x + 256 * y])/(maxdist - mindist + 1);
	        c2 = (255*secondDistBuffer[x + 256 * y])/(maxdist - mindist + 1);
			switch(mode) {
            	case CT_CELLS_1 	: break;
                case CT_CELLS_2 	: c = (c2*c)/255; break;
            	case CT_PARTICLES_1	:
				case CT_PARTICLES_2 : c = 255-c; break;
                case CT_DIAMOND_1 	: c = c2; break;
            	case CT_DIAMOND_2 	:
                case CT_DIAMOND_3 	: c = c2-c; break;
                case CT_MUU			: c = 255-(c-(c2/2)); break;
                default : throw new Error('unknown cell mode')
            }
        	fd.pixels[(x + 256 * y) * 3 + 0] = c;
			fd.pixels[(x + 256 * y) * 3 + 1] = c;
			fd.pixels[(x + 256 * y) * 3 + 2] = c;
		}
}
//------------------------------------------------------------------------------
// zwykla "kula"
//
// PARAMS   0 - blending mode
function envMap(fd) {
	var r = 128;
	var k = 255.0/r;
    var smooth;
	var d;
    var type = fd.params[1];
	for (var y = 0; y < 256; y++)
		for (var x = 0; x < 256; x++) {
			d = Math.sqrt((x-128)*(x-128)+(y-128)*(y-128));
			smooth = 1 - smoothstep(0.8, 1.0, d/r);
			if (d>r) d = r;
            d = r - d;
            if (type == 1) {
	            d = d*0.3 + 0.7*r;
            	d *= k;
                d *= smooth;
            }
            else d *= k;

			fd.pixels[(x + 256 * y) * 3 + 0] = d | 0;
			fd.pixels[(x + 256 * y) * 3 + 1] = d | 0;
			fd.pixels[(x + 256 * y) * 3 + 2] = d | 0;
		}
}
//------------------------------------------------------------------------------
// checker
//
// szachownica
// PARAMS   NONE
function checker(fd) {
    for (var y = 0; y < 256; y++) {
        for (var x = 0; x < 256; x++) {
            var c = ((x&16)^(y&16)) * 16
            c = clamp(c, 0, 255);
            fd.pixels[(x + 256 * y) * 3 + 0] = c;
            fd.pixels[(x + 256 * y) * 3 + 1] = c;
            fd.pixels[(x + 256 * y) * 3 + 2] = c;
        }
    }
}

function layerCopy(dst, src) {
    memcopy(dst.pixels, src.pixels, 256 * 256 * 3)
}

//------------------------------------------------------------------------------
// filters
//------------------------------------------------------------------------------

//po prostu kopiuje dane z warstwy wejsciowej do siebie
function rootFunc(fd)
{
	if ((fd.nSrcs < 1) || (!fd.sources[0])) return;
	layerCopy(fd, fd.sources[0]);
}
//------------------------------------------------------------------------------
// plasm - tak na prawde to sinusy
//
// PARAMS   0 - Num of X-sines
// 			1 - Num of X-sines
// 			2 - X-amplitude",
// 			3 - Y-amplitude",
// 			4 - X-shift", Para
// 			5 - Y-shift", Para
function plasma(fd) {
    var numX   = fd.params[1]*(Math.PI/128.0);
    var numY   = fd.params[2]*(Math.PI/128.0);
    var shiftX = fd.params[3]*(Math.PI/128.0);
    var shiftY = fd.params[4]*(Math.PI/128.0);
   	var c, cy;
    var pixel = 0;

   	for (var y = 0; y < 256; y++) {
		for (var x = 0; x < 256; x++) {
    	    cy = 64 + 64 * Math.sin(numY * x + shiftY);
           	c = cy + 63 + 63 * Math.sin(numX * y + shiftX);
			fd.pixels[pixel++] = c;
			fd.pixels[pixel++] = c;
			fd.pixels[pixel++] = c;
		}
	}
}
//------------------------------------------------------------------------------
// gradient
// TODO dodac kierunek gradientu
//
// PARAMS   0 - blending mode
// 			1 - type [0-linear 1-radial]
//			2 - color1.r
//			3 - color1.g
//			4 - color1.b
//			5 - color2.r
//			6 - color2.g
//			7 - color2.b
function gradient(fd) {
	var type = fd.params[1];
    var r = fd.params[2];
    var g = fd.params[3];
    var b = fd.params[4];
    var dr = (fd.params[5]-r)/256;
    var dg = (fd.params[6]-g)/256;
    var db = (fd.params[7]-b)/256;
    var w2 = fd.width/2;
    var h2 = fd.height/2;
    var k;
    var val;

	for (var y = 0; y < 256; y++) {
		for (var x = 0; x < 256; x++) {
        	if (type==0) {
				fd.pixels[(x + 256 * y) * 3 + 0] = r | 0;//(fd.pixels[(x + 256 * y) * 3 + 0]*r)/255;
				fd.pixels[(x + 256 * y) * 3 + 1] = g | 0;//(fd.pixels[(x + 256 * y) * 3 + 1]*g)/255;
                    fd.pixels[(x + 256 * y) * 3 + 2] = b | 0;//(fd.pixels[(x + 256 * y) * 3 + 2]*b)/255;
            }
            else {
            	k = Math.sqrt((w2-x)*(w2-x)+(h2-y)*(h2-y))*2;
                val = r + k*dr;
            	fd.pixels[(x + 256 * y) * 3 + 0] = clamp(val,0, 255) | 0;
                val = g + k*dg;
                fd.pixels[(x + 256 * y) * 3 + 1] = clamp(val,0, 255) | 0;
                val = b + k*db;
                fd.pixels[(x + 256 * y) * 3 + 2] = clamp(val,0, 255) | 0;
            }
		}
        if (type==0) {
			r += dr;
			g += dg;
			b += db;
        }
	}
}

//------------------------------------------------------------------------------
// mixMap - miesza dwie mapy na podstawie maski/mapy 
//
// PARAMS 	0 - pan (ile procen
//
// INPUT	0 - src1
// 			1 - mask
// 			2 - src2
function mixMap2(fd) {
    if (fd.nSrcs < 3) return;

    var src1 = fd.sources[0];
    var mask = fd.sources[1];
    var src2 = fd.sources[2];
    if ((!src1) && (!src2)) {
      	memset(fd.pixels, 0, 256*256*3);
    	return;
    }

    var type = fd.params[0];
    var val1, val2;
    var k = 1/256.0;

    for(var x=0; x<256; x++)
     for(var y=0; y<256; y++)
        for(var c=0; c<3; c++) {
        	if (mask) {
            	val1 = mask.pixels[(x + 256 * y) * 3 + c]*k;
                val2 = 1 - val1;
            }
            else val1 = val2 = 1;

	        if (src1) {
            	if (src2) fd.pixels[(x + 256 * y) * 3 + c] = pixelOp(type, val1*src1.pixels[(x + 256 * y) * 3 + c], val2*src2.pixels[(x + 256 * y) * 3 + c]);
                else fd.pixels[(x + 256 * y) * 3 + c] = val1*src1.pixels[(x + 256 * y) * 3 + c];
            }
            else if (src2) { //teoretycznie nie musze tego sprawdzac bo spawdizelm juz przy memsecie
            	fd.pixels[(x + 256 * y) * 3 + c] = val2*src2.pixels[(x + 256 * y) * 3 + c];
            }
        }

}

//------------------------------------------------------------------------------
// layerOperator - miesza dwie mapy											 B=4
//
// INPUT	0 - src1
// 			2 - src2
function layerOperator(fd)
{
    if (fd.nSrcs < 2) return;

    var src1 = fd.sources[0];
    var src2 = fd.sources[1];
    if ((!src1) && (!src2)) {
        console.log('vtg:layerOperator one of the sources is empty')
      	memset(fd.pixels, 0, 256*256*3);
    	return;
    }

    var type = fd.params[0];
    var p1 = fd.params[1]/100.0;
    var p2 = fd.params[2]/100.0;

    for(var x=0; x<256; x++)
     for(var y=0; y<256; y++)
        for(var c=0; c<3; c++) {
	        if (src1) {
            	if (src2) fd.pixels[(x + 256 * y) * 3 + c] = pixelOp(
                    type,
                    p1*src1.pixels[(x + 256 * y) * 3 + c],
                    p2*src2.pixels[(x + 256 * y) * 3 + c]
                );
                else fd.pixels[(x + 256 * y) * 3 + c] = p1*src1.pixels[(x + 256 * y) * 3 + c];
            }
            else if (src2) { //teoretycznie nie musze tego sprawdzac bo spawdizelm juz przy memsecie
            	fd.pixels[(x + 256 * y) * 3 + c] = p2*src2.pixels[(x + 256 * y) * 3 + c];
            }
        }

}



function DrawParticle(fd, fx, fy, max) {
    var partRadius = 2;
	var r2;
    var c;
    fx = fx | 0
    fy = fy | 0
    for(var y=-partRadius; y<=partRadius; y++)
	    for(var x=-partRadius; x<=partRadius; x++) {
            r2 = x*x + y*y;
            c = 1 - r2/(partRadius*partRadius);
            if (c < 0) c=0;
            c *= max;
            fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 0] = Math.min(255, fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 0] + c);
            fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 1] = Math.min(255, fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 1] + c);
            fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 2] = Math.min(255, fd.pixels[(x+fx + 256 * (y+fy)) * 3 + 2] + c);
    	}
}

//------------------------------------------------------------------------------
// flare
//
// PARAMS   0 - mode

function flare(fd)
{
	var mode = fd.params[1];
	var d;
    var c;
    var r = fd.params[2];
    var intensity = fd.params[3];

    if (mode == FM_RAYS) {
    	var numParticles = 128;
        var angle;
        var dx, dy, fx, fy;
        var steps = r;
        var step, val;
        //czyscimy bufor
        memset(fd.pixels, 0, fd.width * fd.height * fd.nchannels);
        for(var i=0; i<numParticles; i++) {
        	angle = floatNoise(i)*Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            fx = fd.width/2;
            fy = fd.height/2;
            val = 16*(intensity/255.0);
            steps = r/2 + (r/2)*floatNoise(angle*i + 13)+1;
            step = val/steps;
            for(var n=0; n<steps; n++) {
		        DrawParticle(fd, fx, fy, val);
                val -= step;
		        fx += dx;
       			fy += dy;
            }
        }
    }
    else
	for (var y = 0; y < 256; y++)
		for (var x = 0; x < 256; x++) {
			d = Math.sqrt((x-128)*(x-128)+(y-128)*(y-128))/(r+1);
            switch(mode) {
            case FM_GLOW :
            	c = 1-d;
                if (c<0) c = 0;
            	break;
            case FM_BIG_HALO :
            	c = d;
                c *= 1 - smoothstep(0.98, 1.02, d);
                break;
            case FM_SMALL_HALO :
	            c = d*d;
    		    c = c*c*c;
                c *= 1 - smoothstep(0.98, 1.02, d);
                break;
            case FM_RING :
	            c = 1-Math.abs(d-0.92)/0.08;
				if (c < 0) c = 0;
        	    c = c*c;
                break;
            }

			c *= intensity;
			fd.pixels[(x + 256 * y) * 3 + 0] = c | 0;
			fd.pixels[(x + 256 * y) * 3 + 1] = c | 0;
			fd.pixels[(x + 256 * y) * 3 + 2] = c | 0;
        }
}

//------------------------------------------------------------------------------
// brightnessContrast
//
// PARAMS   0 - brightness
//			1 - contrast
//
// INPUT	0 - src
function brightnessContrast(fd) {
	if (fd.nSrcs != 1) return;
   	if (!fd.sources[0]) {
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
    var bright = fd.params[0]-128;
    var contr = fd.params[1]/32.0;
    var val;

	for(var x=0; x<256; x++)
		for(var y=0; y<256; y++)
	      	for(var c=0; c<3; c++) {
                val = (src.pixels[(x + 256 * y) * 3 + c]-128)*contr + 128;
                val = val + bright;

                val = clamp(val, 0, 255);
				fd.pixels[(x + 256 * y) * 3 + c] = val;
		    }
}

//------------------------------------------------------------------------------
// treshold
//
// PARAMS   0 - treshold
//
// INPUT	0 - src
// 			1 - mask
function threshold(fd)
{
	if (fd.nSrcs != 1) return;
   	if (!fd.sources[0]) {
        console.log('vtg: threshold no source')
    	memset(fd.pixels, 0, 256*256*3);
    	return;
    }
    var src = fd.sources[0];
    var hi = fd.params[0];
    var low = fd.params[1];

	for(var x=0; x<256; x++)
		for(var y=0; y<256; y++)
	      	for(var c=0; c<3; c++) {
            	if (src.pixels[(x + 256 * y) * 3 + c] > hi || src.pixels[(x + 256 * y) * 3 + c] < low)
	                fd.pixels[(x + 256 * y) * 3 + c] = 255;
                else  fd.pixels[(x + 256 * y) * 3 + c] = 0;
		    }
}

//------------------------------------------------------------------------------
// "chmurki"
// PARAMS   0 - blending mode
//			1 - num of iterations
//			2 - random seed 1
//			3 - random seed 2
function perlinNoise(fd)
{
	//czyscimy bo subplasmy dodaja sie do tego co jest i by nam sie kumulowalo
	memset(fd.pixels, 0, fd.width * fd.height * fd.nchannels);
	var nIterations = Math.max(fd.params[1],1);
    //przesuwam te parametry zeby zrobic miejsce na waveLength
	fd.params[4] = fd.params[3];
	fd.params[3] = fd.params[2];
    fd.params[5] = 1; //dzieki temu kolejne wywolania beda sie kumulowac
    var freq=128;
	while(nIterations-- > 0) {
		fd.params[1] = freq;
		fd.params[2] = freq*2-1;
	    freq *= 0.5;
        //console.log('perlinNoise', nIterations)
		subplasma(fd);
	}
}

function filterFactory(id) {
    switch(id) {
        case FFID_Root			: return rootFunc;
        case FFID_Checker		: return checker;
        case FFID_Envmap		: return envMap;
        case FFID_Subplasma		: return subplasma;
        case FFID_PerlinNoise	: return perlinNoise;
        case FFID_Cells			: return cells;
        case FFID_Gradient		: return gradient;
        case FFID_Plasma		: return plasma;
        case FFID_Flare			: return flare;

        case FFID_Colorize		: return colorize;
        case FFID_Emboss		: return emboss;
        case FFID_BrightnessContrast : return brightnessContrast;
        case FFID_Threshold		: return threshold;

        case FFID_MixMap		: return mixMap2;
        case FFID_LayerOperator : return layerOperator;

        case FFID_Sinus			: return sinus;
        case FFID_Twirl			: return twirl;
        case FFID_DistortMap	: return distortMap;
        case FFID_Offset		: return offset;

        default :
            console.log('Missing filter', id)
            return checker;
    }
}

function pixelOp(type, c1, c2) {
    switch(type) {
        case LOP_ADD:
            var k = c1 + c2;
            return clamp(k,0,255);

        case LOP_MUL:
            return (c1*c2)/255;

        case LOP_MIN:
            return Math.min(c1, c2);

        case LOP_MAX:
            return Math.max(c1, c2);
    }
    return 0
}

//------------------------------------------------------------------------------

function layerOp(type, p1, p2) {
    if (!p1 || !p2) return;
    if (type == LOP_NONE) return;
    for (var y = 0; y < 256; y++) {
        for (var x = 0; x < 256; x++) {
            for(var c=0; c<3; c++) {
                p1.pixels[(x + 256 * y) * 3 + c] = pixelOp(
                    type,
                    p1.pixels[(x + 256 * y) * 3 + c],
                    p2.pixels[(x + 256 * y) * 3 + c]
                );
            }
        }
    }
}

function makeArray(n) {
    var result = [];
    for(var i=0; i<n; i++) {
        result.push(0);
    }
    return result;
}

function loadFilterFromBuffer(arraybuf, offset, tab, verbose) {
    if (verbose) {
        tab = tab || ''
        console.log(tab + 'vtg: offset', offset, 'buf.len', arraybuf.byteLength)
    }

    //Filter Data
    var fd = {
        //pixel data
        pixels: makeArray(256 * 256 * 3),
        width: 256,
        height: 256,
        nchannels: 3,
        //filter data
        id: -1,
        nSrcs: 0,
        params: makeArray(8),
        sources: [],
        filterFunc: null
    };

    fd.id = new Uint16Array(arraybuf.slice(offset, offset + 2))[0];
    offset += 2
    if (verbose) console.log(tab + 'vtg: id', fd.id, FilterNameMap[fd.id])
    if (fd.id == 0) {
        return {
            offset: offset,
            data: null
        };
    }

    var buf = new Uint8Array(arraybuf)

    fd.params = Array.prototype.slice.call(buf, offset, offset + MAX_PARAMS_SIZE)
    offset += MAX_PARAMS_SIZE
    if (verbose) console.log(tab + 'vtg: params', fd.params)

    fd.nSrcs = buf[offset]
    offset += 1
    if (verbose) console.log(tab + 'vtg: nSrcs', fd.nSrcs)

    fd.sources = [];
    for(var i=0; i<fd.nSrcs; i++) {
        var result = loadFilterFromBuffer(arraybuf, offset, tab + '    ', verbose)
        if (result) {
            offset = result.offset;
            fd.sources[i] = result.data
        }
    }
    fd.filterFunc = filterFactory(fd.id)
    if (verbose) console.log(tab + 'vtg: apply', fd.id)
    fd.filterFunc(fd)
    //console.log(tab + 'vtg: result', fd.id, fd.pixels.slice(10000, 10000+20).join(','))

    //creator category
    if (fd.id > 0 && fd.id < 10) {
        if (verbose) console.log(tab + 'vtg: layerOp', fd.params[0])
        layerOp(fd.params[0], fd, fd.sources[0])
    }

    return {
        data: fd,
        offset: offset
    }
}

function parseVTG(arraybuf, verbose) {
    verbose = verbose || false;
    var offset = 0;

    var buf = new Uint8Array(arraybuf)

    var version = [
        buf[offset++],
        buf[offset++],
        buf[offset++]
    ].map(function(c) {
        return String.fromCharCode(c)
    })

    offset++; //version header is 4 bytes long

    if (verbose) console.log('vtg:parse')
    if (verbose) console.log('vtg:parseVTG version', version) //should print V T G
    if (verbose) console.log('vrg:buf', buf.join(','))

    var result = loadFilterFromBuffer(arraybuf, offset, '', verbose)
    if (verbose) console.log('vtg:parse end', result.offset, arraybuf.byteLength)
    return result.data;
}

module.exports = parseVTG;
