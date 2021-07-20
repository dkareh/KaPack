import pjs from "pjs";
import * as util from "./util.js";

var _SECRET = "SECRET! SHH!";

function Vector(_secret, x, y, z) {
    if (_secret !== _SECRET) {
        throw { message: "You cannot use the new keyword on Vector." };
    }

    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
}

// This work-around is needed to avoid memory leaks.
Vector.new = function () {
    var instance = Object.create(Vector.prototype);
    Vector.apply(instance, [_SECRET].concat(Array.prototype.slice.call(arguments)));
    return instance;
};

Vector.prototype.toString = function () {
    return "{ " + this.x + ", " + this.y + ", " + this.z + " }";
};

Vector.add = function (a, b) {
    return Vector.new(a.x + b.x, a.y + b.y, a.z + b.z);
};

Vector.sub = function (a, b) {
    return Vector.new(a.x - b.x, a.y - b.y, a.z - b.z);
};

Vector.prototype.lengthSq = function () {
    return util.distanceSq(0, 0, this.x, this.y) + this.z * this.z;
};

export { Vector };
