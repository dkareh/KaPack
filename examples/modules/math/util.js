export function distanceSq(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
};

export let notSecret = "notSecret";
export const constant = 42;
export let { foo, bar: baz } = { foo: 2, bar: 5 };