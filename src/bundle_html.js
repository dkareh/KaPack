const detectIndent = require("detect-indent");
const fs = require("fs");
const htmlparser2 = require("htmlparser2");
const path = require("path");
const postcss = require("postcss");
const postcssValueParser = require("postcss-value-parser");

const bundleJS = require("./bundle_javascript.js");
const stringUtil = require("./string_util.js");

function loadCssAndResolveImports(cssPath, alreadyImported = []) {
	const source = fs.readFileSync(cssPath, "utf-8").trim();
	const parseTree = postcss.parse(source);
	const importNodes = parseTree.nodes.filter((node) => {
		return node.type == "atrule" && node.name == "import";
	});
	alreadyImported = alreadyImported.concat(path.normalize(cssPath));
	return importNodes
		.reduceRight((string, node) => {
			try {
				const location = node.source;
				const startLocation = location.start;
				const endLocation = location.end;

				const importParamsTree = postcssValueParser(node.params);
				let supportsQuery = "";
				importParamsTree.nodes.forEach((node) => {
					if (node.type === "function" && node.value === "supports") {
						// Thank god that postcss-value-parser has a stringify function or
						// else this would be way more painful than necessary.
						supportsQuery = postcssValueParser.stringify(node.nodes);
					}
				});

				// TODO: Remove extraneous spaces on the left and right edge.
				const possibleMediaQueryNodes = importParamsTree.nodes.filter((node, index) => {
					if (node.type === "function" && node.value === "supports") {
						return false;
					}

					// URL/string is always first, remove it.
					if (index === 0) {
						return false;
					}

					return true;
				});
				const mediaQuery =
					possibleMediaQueryNodes.length === 0 ? "" : postcssValueParser.stringify(possibleMediaQueryNodes);

				let importPartialPath = "";
				if (importParamsTree.nodes[0].type === "function" && importParamsTree.nodes[0].value === "url") {
					importPartialPath = importParamsTree.nodes[0].nodes[0].value;
				} else {
					importPartialPath = importParamsTree.nodes[0].value;
				}

				const fullPath = path.join(path.dirname(cssPath), importPartialPath);
				if (alreadyImported.indexOf(path.normalize(fullPath)) >= 0) {
					throw new Error("Circular import!");
				}

				let toInsert = loadCssAndResolveImports(fullPath, alreadyImported.concat(path.normalize(fullPath)));

				if (supportsQuery !== "") {
					toInsert = stringUtil.indent(toInsert, "    ");
					toInsert = `@supports ${supportsQuery} {\n${toInsert}\n}`;
				}

				if (mediaQuery !== "") {
					toInsert = stringUtil.indent(toInsert, "    ");
					toInsert = `@media ${mediaQuery} {\n${toInsert}\n}`;
				}

				return stringUtil.spliceString(
					string,
					startLocation.offset,
					endLocation.offset - startLocation.offset + 1, // +1 to remove the semicolon at end of @import rule.
					toInsert + "\r\n",
				);
			} catch (error) {
				return string;
			}
		}, source)
		.trim();
}

// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
// prettier-ignore
const voidElements = [
	"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
];

/**
 * @param {string} directory
 * @param {string} html
 */
async function bundleHtml(directory, html) {
	let ignoreEventsUntilClose = false;
	const segments = [];
	const promises = [];
	const parser = new htmlparser2.Parser(
		{
			onopentag(name, attributes) {
				if (ignoreEventsUntilClose) return;
				if (name == "script" && attributes.src) {
					const newAttributes = Object.entries(attributes)
						.filter(([key]) => key != "src")
						.map(([key, value]) => ` ${key}="${value}"`)
						.join("");
					const newOpenTag = `<script${newAttributes}>`;
					if (attributes.src.endsWith(".js")) {
						segments.push(newOpenTag);
						const promise = bundleJS(directory, {
							mode: "html",
							main: attributes.src,
						});
						const index = segments.length;
						promise.then((data) => {
							segments.splice(index, 0, data);
						});
						promises.push(promise);
						ignoreEventsUntilClose = true;
						return;
					} else {
						const contentsPromise = fs.promises.readFile(path.join(directory, attributes.src), "utf-8");
						promises.push(contentsPromise);
						const index = segments.length;
						const original = html.substring(parser.startIndex, parser.endIndex + 1);
						contentsPromise
							.then((contents) => {
								segments.splice(index, 0, newOpenTag + "\n" + contents);
							})
							.catch((reason) => {
								segments.splice(index, 0, original);
							});
						ignoreEventsUntilClose = true;
						return;
					}
				}
				if (name == "link" && attributes.rel.includes("stylesheet") && attributes.href) {
					const href = path.join(directory, attributes.href);
					const mediaQuery = attributes.media;
					try {
						const mediaAttr = !mediaQuery ? "" : ` media="${mediaQuery}"`;
						const source = loadCssAndResolveImports(href);
						// const css = stringUtil.indent(source, baseIndent + singleIndent);
						const css = source;
						// segments.push(`<style${mediaAttr}>\n${css}\n${baseIndent}</style>`);
						segments.push(`<style${mediaAttr}>\n${css}\n</style>`);
						return;
					} catch (error) {}
				}
				segments.push(html.substring(parser.startIndex, parser.endIndex + 1));
			},
			ontext(data) {
				if (ignoreEventsUntilClose) return;
				segments.push(data);
			},
			onclosetag(name) {
				if (ignoreEventsUntilClose) {
					segments.push(html.substring(parser.startIndex, parser.endIndex + 1));
					ignoreEventsUntilClose = false;
					return;
				}
				if (voidElements.includes(name)) return;
				segments.push(html.substring(parser.startIndex, parser.endIndex + 1));
			},
			oncomment(data) {
				if (ignoreEventsUntilClose) return;
				segments.push(html.substring(parser.startIndex, parser.endIndex + 1));
			},
			onprocessinginstruction(name, data) {
				if (ignoreEventsUntilClose) return;
				segments.push("<" + data + ">");
			},
		},
		{},
	);
	parser.end(html);
	try {
		await Promise.allSettled(promises);
	} catch (error) {}
	return segments.join("");
}

module.exports = async (directory) => {
	try {
		const rootHtmlPath = path.join(directory, "index.html");
		let html;
		try {
			html = fs.readFileSync(rootHtmlPath, "utf-8");
		} catch (error) {
			return null;
		}
		html = (await bundleHtml(directory, html)).trim();
		return html;
	} catch (error) {
		// TODO: Stop abusing try catch it makes it hard to find actual errors
		console.error(error);
		return null;
	}
};
