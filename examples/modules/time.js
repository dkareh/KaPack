import pjs from "pjs";

var initialTime = pjs.millis() / 1000;
export default function () {
    return pjs.millis() / 1000 - initialTime;
}
