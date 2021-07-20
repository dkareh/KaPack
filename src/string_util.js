const path = require("path");

// NOTE: Fallback to this implementation if the new one contains bugs.
// const findButKeepEOL = /(?<=\r\n|\n|\r(?!\n))/;
// exports.splitIntoLines = (string) => string.split(findButKeepEOL);
// exports.mapPerLine = (string, fn) => exports.splitIntoLines(string).map(fn).join("");

exports.splitIntoLines = (string) => {
	const lines = string.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g);
	// This regular expression match always seems to insert an extra empty match at the end
	// (for some unknown reason), so let's just pop() lines.
	lines.pop();
	return lines;
};

exports.mapPerLine = (string, fn) => exports.splitIntoLines(string).map(fn).join("");

const blankLineRegex = /^[\r\n]*$/;
exports.indent = (string, indentation) => {
	return exports.mapPerLine(string, (line) => {
		if (blankLineRegex.test(line)) { return line; }
		return indentation + line;
	});
};

exports.normalizePath = (string) => {
	let normalized = path.normalize(string).replace(/\\/g, "/");
	// Remove trailing slash.
	if (normalized.endsWith("/") && normalized != "/") {
		normalized = normalized.substring(0, normalized.length - 1);
	}
	return normalized;
};

exports.spliceString = (string, startIndex, deleteCount, insert) => {
	return string.slice(0, startIndex) + insert + string.slice(startIndex + deleteCount);
};