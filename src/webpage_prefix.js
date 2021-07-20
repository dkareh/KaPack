var __temp__,
    __modules__ = {},
    __currentModuleName__ = "main";

function __exportAll(module, importModule) {
    Object.getOwnPropertyNames(importModule).forEach(function (property) {
        if (property === "__default") {
            // Don't set default export.
            return;
        }
        module[property] = importModule[property];
    });
}

function __exportConst(module, name, value) {
    Object.defineProperty(module, name, {
        value: value,
        enumerable: true,
    });

    // Object.defineProperty(module, name, {
    //     enumerable: true,
    //     set: function() { throw { message: "Cannot assign to constant export '" + name + "'" } },
    //     get: function() { return value; }
    // });
}

function require(name) {
    if (typeof __modules__[name] === "function") {
        var module = {};
        __modules__[name](module);
        __modules__[name] = module;
    }
    return __modules__[name];
}

// Do I even need a separate function when I'm doing
// most of the checking beforehand? No.
function addModule(name, func) {
    __modules__[name] = function (module) {
        var previousModuleName = __currentModuleName__;
        __currentModuleName__ = name;
        func(module);
        __currentModuleName__ = previousModuleName;
    };
}
