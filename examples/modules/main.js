// This is the entry point of the program.
import foo from "foo.js";
import bar from "./bar.js";
import pjs from "pjs";
import time from "time.js";
import { Vector } from "./math/..\\math//vector.js";

function draw() {
    pjs._clearLogs();
    foo();
    bar();
    pjs.println(time().toFixed(2) + " seconds");

    var a = Vector.new(1.2, 3.4, 5.6);
    var b = Vector.new(7.8, 9.1, 2.3);

    pjs.println("a = " + a);
    pjs.println("b = " + b);
    pjs.println("a + b = " + Vector.add(a, b));
    pjs.println("|a|^2 = " + a.lengthSq());
}

pjs.draw = function () {
    try {
        draw();
    } catch (error) {
        pjs._clearLogs();
        pjs.println(error.message);
        pjs.noLoop();
    }
};
