// https://www.npmjs.com/package/htmlparser2
// consider using this parser instead
// much faster it seems
// enough node location information to work with too

const detectIndent = require("detect-indent");
const fs = require("fs");
const parse5 = require("parse5");
const path = require("path");
const postcss = require("postcss");
const postcssValueParser = require("postcss-value-parser");

const bundleJS = require("./bundle_javascript.js");
const stringUtil = require("./string_util.js");

function flattenNode(node) {
	const nodes = [node];
	if ("childNodes" in node) {
		for (const childNode of node.childNodes) {
			nodes.push(...flattenNode(childNode));
		}
	}
	return nodes;
}

function findCssLinks(node) {
	return flattenNode(node).filter((node) => {
		return node.nodeName == "link" && getAttrValue(node, "rel") == "stylesheet";
	});
}

function findScripts(node) {
	return flattenNode(node).filter((node) => {
		const src = getAttrValue(node, "src");
		return node.nodeName == "script" && src != null && src != "";
	});
}

function getAttrValue(element, name) {
	if (!("attrs" in element)) { return null; }
	for (const attr of element.attrs) {
		if (attr.name == name)
			return attr.value;
	}
	return null;
}

function loadCssAndResolveImports(cssPath, alreadyImported = []) {
	const source = fs.readFileSync(cssPath, "utf-8").trim();
	const parseTree = postcss.parse(source);
	const importNodes = parseTree.nodes.filter((node) => {
		return node.type == "atrule" && node.name == "import";
	});
	alreadyImported = alreadyImported.concat(path.normalize(cssPath));
	return importNodes.reduceRight((string, node) => {
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
				if (node.type === "function" && node.value === "supports") { return false; }

				// URL/string is always first, remove it.
				if (index === 0) { return false; }

				return true;
			});
			const mediaQuery = possibleMediaQueryNodes.length === 0 ? "" :
				postcssValueParser.stringify(possibleMediaQueryNodes);

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

			return stringUtil.spliceString(string, startLocation.offset, endLocation.offset - startLocation.offset + 1, // +1 to remove the semicolon at end of @import rule.
				toInsert + "\r\n");
		} catch (error) {
			return string;
		}
	}, source).trim();
}

async function handleReplacement(replacement, directory, singleIndent, baseIndent) {
	// Handle CSS insertion.
	if (replacement.tagName == "link") {
		const href = path.join(directory, getAttrValue(replacement, "href"));
		const mediaQuery = getAttrValue(replacement, "media");
		try {
			const mediaAttr = mediaQuery == null ? "" : ` media="${mediaQuery}"`;
			const source = loadCssAndResolveImports(href);
			const css = stringUtil.indent(source, baseIndent + singleIndent);
			return `<style${mediaAttr}>\n${css}\n${baseIndent}</style>`;
		} catch (error) {
			return null;
		}
	}
	// Handle script bundling.
	if (replacement.tagName != "script") { return null; }
	const type = getAttrValue(replacement, "type");
	const typeAttr = type == null ? "" : ` type="${type}"`;
	try {
		// const code = common.indent(
		// 	bundleJS(fs.readFileSync(path.join(directory, src), "utf-8").trim(),
		// 	baseIndent + singleIndent
		// );
		const src = getAttrValue(replacement, "src");
		if (src.endsWith(".js")) {
			// TODO: Preserve all attributes, not just type.
			const bundledCode = await bundleJS(directory, { mode: "html", main: src });
			const indentedCode = stringUtil.indent(
				bundledCode.trim(),
				baseIndent/* + singleIndent*/
			);
			return `<script${typeAttr}>\n${indentedCode}\n${baseIndent}</script>`;
		}
		// Assume that files not ending with .js are not JavaScript files
		// and therefore should not be bundled. Just read and insert.
		const sourceCode = await fs.promises.readFile(path.join(directory, src), "utf-8");
		const indented = stringUtil.indent(
			sourceCode.trim(),
			baseIndent/* + singleIndent*/
		);
		let otherAttrs = Object.values(replacement.attrs).filter((attr) => {
			return attr.name !== "src";
		}).map((attr) => {
			return `${attr.name}="${attr.value}"`;
		}).join(" ");
		if (otherAttrs.length !== 0) { otherAttrs = " " + otherAttrs; }
		return `<script${otherAttrs}>\n${indented}\n${baseIndent}</script>`;
	} catch (error) {
		return null;
	}
}

async function asyncReduceRight(array, fn, start) {
	let value = start;
	for (let index = array.length - 1; index >= 0; index--) {
		value = await fn(value, array[index]);
	}
	return value;
}

async function bundleHtml(directory, html) {
	const document = parse5.parse(html, { sourceCodeLocationInfo: true });
	const lines = html.split(/\r\n|\r|\n/);
	const indents = lines.map((line) => (line.match(/^\s*/) || [""])[0]);
	const htmlIndent = detectIndent(html).indent || "    ";
	// Sort replacements into document order.
	const replacements = findCssLinks(document).concat(findScripts(document))
	.sort((a, b) => {
		var _a, _b;
		const aOffset = (_a = a.sourceCodeLocation) === null || _a === void 0 ? void 0 : _a.startOffset;
		const bOffset = (_b = b.sourceCodeLocation) === null || _b === void 0 ? void 0 : _b.startOffset;
		return aOffset - bOffset;
	});

	return asyncReduceRight(replacements, async (string, replacement) => {
		const location = replacement.sourceCodeLocation;
		const indent = indents[location.startLine - 1];
		const stringToInsert = await handleReplacement(replacement, directory, htmlIndent, indent);
		return stringToInsert == null ? string :
			stringUtil.spliceString(string, location.startOffset, location.endOffset - location.startOffset, stringToInsert);
	}, html);
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