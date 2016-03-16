var kdt = require('kdt');

var defaultDimensions = [0, 1, 2];

var defaultMetric = function vec3distance(a, b) {
    var d0 = b[0] - a[0];
    var d1 = b[1] - a[1];
    var d2 = b[2] - a[2];
    return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
}

function createSpatialIndex(points, metric, dimensions, accuracy) {
    var unique = [];

    points     = points     || [];
    metric     = metric     || defaultMetric;
    dimensions = dimensions || defaultDimensions;
    accuracy   = accuracy   || 0.0;

    var tree = kdt.createKdTree([], metric, dimensions);

    points.map(function(p, i) {
        if (unique.length == 0) {
            unique.push(p);
            tree.insert(p);
            return;
        }
        var results = tree.nearest(p, 1);
        var nearestInfo = results[0];
        var uniquePoint = nearestInfo[0];
        var nearestPointDistance = nearestInfo[1];
        if (nearestPointDistance > accuracy) {
            unique.push(p);
            tree.insert(p);
        }
    });

    return {
        getUniquePoints: function() {
            return unique;
        },
        nearestPoint: function(p) {
            if (unique.length == 0) {
                return null;
            }
            var results = tree.nearest(p, 1);
            var nearestInfo = results[0];
            var uniquePoint = nearestInfo[0];
            return uniquePoint;
        },
        includePoint: function(p) {
            if (unique.length == 0) {
                unique.push(p);
                tree.insert(p);
                return unique.length - 1;
            }
            var results = tree.nearest(p, 1);
            var nearestInfo = results[0];
            var uniquePoint = nearestInfo[0];
            var nearestPointDistance = nearestInfo[1];
            if (nearestPointDistance > accuracy) {
                unique.push(p);
                tree.insert(p);
                return unique.length - 1;
            }
            else {
                return unique.indexOf(nearestInfo[0]);
            }
        },
        indexOf: function(p) {
            if (unique.length == 0) {
                return -1;
            }
            var results = tree.nearest(p, 1);
            var nearestInfo = results[0];
            var uniquePoint = nearestInfo[0];
            var nearestPointDistance = nearestInfo[1];
            if (nearestPointDistance > accuracy) {
                return -1;
            }
            else {
                return unique.indexOf(nearestInfo[0]);
            }
        }
    };
}

module.exports = createSpatialIndex;
