exports.bold = (string) => `\x1b[1m${string}\x1b[22m`;
exports.underline = (string) => `\x1b[4m${string}\x1b[24m`;
exports.red = (string) => `\x1b[91m${string}\x1b[39m`;

exports.heading = (string) => exports.bold(exports.underline(string));
exports.error = (string) => exports.bold(exports.red(string));
