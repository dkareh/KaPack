function main() {
    var pjs = this;
    pjs.noop = pjs.noop || pjs.draw;

    pjs.draw = pjs.noop;
    pjs.mousePressed = pjs.noop;
    pjs.mouseClicked = pjs.noop;

    pjs.smooth();

    var numPoints = 3,
        outerCircleRadius = 150,
        backgroundColor = color(20, 30, 40),
        strokeColor = color(150);

    pjs.draw = function () {
        var time = millis() / 1000;

        pjs.background(backgroundColor);

        pjs.strokeWeight(5);
        pjs.strokeCap(pjs.SQUARE);

        var opacity = cos(time * 40) * 0.5 + 0.5;
        pjs.stroke(pjs.lerpColor(backgroundColor, strokeColor, opacity));

        for (var i = 0; i < numPoints; i++) {
            var theta = (180 * i) / numPoints;

            var outerX = cos(theta) * outerCircleRadius;
            var outerY = sin(theta) * outerCircleRadius;

            line(200 - outerX, 200 - outerY, 200 + outerX, 200 + outerY);
        }

        pjs.strokeWeight(10);
        pjs.stroke(20, 70, 170, (1 - opacity) * 255);
        pjs.noFill();

        var fakeCircleX = 200 + (cos(-time * 40) * outerCircleRadius) / 2;
        var fakeCircleY = 200 + (sin(-time * 40) * outerCircleRadius) / 2;
        pjs.ellipse(fakeCircleX, fakeCircleY, outerCircleRadius, outerCircleRadius);

        pjs.noStroke();
        pjs.fill(40, 150, 220);

        for (var i = 0; i < numPoints; i++) {
            var theta = (180 * i) / numPoints;

            var outerX = cos(theta) * outerCircleRadius;
            var outerY = sin(theta) * outerCircleRadius;

            var distance = cos(time * 40 + theta);
            var x = distance * outerX + 200;
            var y = distance * outerY + 200;

            ellipse(x, y, 30, 30);
        }
    };
}

main();
