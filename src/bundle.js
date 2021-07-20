const bundleHtml = require("./bundle_html.js");
const bundleJavaScript = require("./bundle_javascript.js");
const fs = require("fs");
const path = require("path");
const term = require("./term.js");

module.exports = async (directory) => {
	try {
		await fs.promises.stat(path.join(directory, "index.html"));
		const html = await bundleHtml(directory);
		if (html !== null) {
			return html;
		}
	} catch (error) {}

	try {
		await fs.promises.stat(path.join(directory, "main.js"));
		const javaScript = await bundleJavaScript(directory, { mode: "processing-js" });
		if (javaScript !== null) {
			return javaScript;
		}
	} catch (error) {}

	console.error(term.error("[ERROR]") + " Directory does not contain index.html or main.js file");
	return null;
};
