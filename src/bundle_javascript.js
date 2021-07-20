// TODO: Use detect indent to match indentation of source code and be consistent :)
// TODO: Convert all uses of == and != to === and !==.
// TODO: "use strict"; everywhere?

// TODO: Support more complex object/array initializers in export statements.
// So far we support this: export const { name1, name2: bar } = o;
// But what about: export const { name1: { foo: alias }, name2: bar } = o;
// Which should generate something like:
// __module__.alias = o.name1.foo;
// IDK if there's anything else in the syntax to support.
// Also, would array syntax work? I'm guessing you can't export values
// identified by numbers, so no.

const acorn = require("acorn");
const detectIndent = require("detect-indent");
const fs = require("fs");
const path = require("path");

const stringUtil = require("./string_util.js");

const processingJsPrefix = fs.readFileSync(path.resolve(__dirname, "processing_js_prefix.js"), "utf-8");
const processingJsSuffix = fs.readFileSync(path.resolve(__dirname, "processing_js_suffix.js"), "utf-8");

const webpagePrefix = fs.readFileSync(path.resolve(__dirname, "webpage_prefix.js"), "utf-8");
const webpageSuffix = fs.readFileSync(path.resolve(__dirname, "webpage_suffix.js"), "utf-8");

const acornConfig = {
	ecmaVersion: 12,
	sourceType: "module",
	ranges: true,
};

function formatSpecifier(moduleVar, specifier) {
	switch (specifier.type) {
		case "ImportDefaultSpecifier":
			return `var ${specifier.local.name} = ${moduleVar}.__default;`;
		case "ImportNamespaceSpecifier":
			return `var ${specifier.local.name} = ${moduleVar};`;
		case "ImportSpecifier": {
			const alias = specifier.local.name;
			return `var ${alias} = ${moduleVar}.${specifier.imported.name};`;
		}
	}
}

function formatImportNode(directory, filename, node) {
	const directoryOfFile = path.dirname(path.resolve(directory, filename));
	const importFullPath = path.resolve(directoryOfFile, node.source.value);
	let normalizedPath = `"${stringUtil.normalizePath(path.relative(directory, importFullPath))}"`;
	if (node.source.value === "pjs") {
		normalizedPath = `"pjs"`; // "pjs" is not a normal module. There is no relative paths or anything.
	}

	const specifiers = node.specifiers;
	if (specifiers.length === 0) {
		return `require(${normalizedPath})`;
	}
	// When there is only one import specifier, simplify the code by
	// not assigning the temporary module variable.
	if (specifiers.length === 1) {
		const specifier = specifiers[0];
		return formatSpecifier(`require(${normalizedPath})`, specifier);
	}
	const formattedImports = node.specifiers.map((specifier) => formatSpecifier("__temp__", specifier));
	return `__temp__ = require(${normalizedPath});\n` + formattedImports.join("\n");
}

function formatExportDeclaration(mainSource, declaration, isConst) {
	function assignExport(name, value) {
		if (isConst) {
			return `__exportConst(__module__, "${name}", ${value});`;
		}
		return `__module__.${name} = ${value};`;
	}

	if (declaration.id.type === "ObjectPattern") {
		// Using object destructuring to create a whole set of exported variables.
		// Store object in __temp__ and output line for each property.
		const range = declaration.init.range;
		const init = `__temp__ = ${mainSource.substring(range[0], range[1])};`;

		return [init].concat(
			declaration.id.properties.map((property) => {
				return assignExport(`${property.value.name}`, `__temp__.${property.key.name}`);
			}),
		);
	}

	if (declaration.init) {
		const initValue = mainSource.substring(declaration.init.range[0], declaration.init.range[1]);
		return assignExport(`${declaration.id.name}`, initValue);
	}
	return assignExport(`${declaration.id.name}`, "void 0");
}

function formatExportNode(directory, filename, mainSource, node) {
	if (node.type === "ExportAllDeclaration") {
		if (node.exported) {
			// Exporting module contents under a different name.
			return `__module__.${node.exported.name} = require(${node.source.raw});`;
		} else {
			return `__exportAll(__module__, require(${node.source.raw}))`;
		}
	}

	if (node.type === "ExportDefaultDeclaration") {
		const range = node.declaration.range;
		const declarationSource = mainSource.substring(range[0], range[1]);

		// HACKY: How should I handle this? KA complains about "extra"
		// semicolons although it doesn't impact behavior.
		const needsSemicolon = mainSource[range[1]] !== ";";

		return `__module__.__default = ${declarationSource}${needsSemicolon ? ";" : ""}`;
	}

	// Should be "ExportNamedDeclaration".
	if (node.declaration) {
		const declaration = node.declaration;
		if (declaration.type === "FunctionDeclaration") {
			const functionSource = mainSource.substring(declaration.range[0], declaration.range[1]);

			// HACKY: How should I handle this? KA complains about "extra"
			// semicolons although it doesn't impact behavior.
			const needsSemicolon = mainSource[declaration.range[1]] !== ";";

			return `__module__.${declaration.id.name} = ${functionSource}${needsSemicolon ? ";" : ""}`;
		}

		// Should be "VariableDeclaration".
		const isConst = node.declaration.kind === "const";
		return declaration.declarations
			.map((declaration) => formatExportDeclaration(mainSource, declaration, isConst))
			.flat()
			.join("\n");
	}

	// Might be exporting values from current module or from another module.
	const exportPrefix = node.source ? `require(${node.source.raw}).` : "";
	return node.specifiers
		.map((specifier) => {
			const localName = specifier.local.name === "default" ? "__default" : specifier.local.name;
			const exportName = specifier.exported.name === "default" ? "__default" : specifier.exported.name;
			return `__module__.${exportName} = ${exportPrefix}${localName};`;
		})
		.join("\n");
}

function isImportNode(node) {
	return node.type === "ImportDeclaration";
}

function isExportNode(node) {
	return ["ExportAllDeclaration", "ExportDefaultDeclaration", "ExportNamedDeclaration"].indexOf(node.type) >= 0;
}

function transformSourceCode(directory, filename, string, ast) {
	if (filename.endsWith(".json")) {
		return `__module__.__default = ${string};\n__exportAll(__module__, __module__.__default);`;
	}
	const importsAndExports = ast.body.filter((node) => isImportNode(node) || isExportNode(node));
	return importsAndExports.reduceRight((string, node) => {
		const range = node.range;
		const formatted = isImportNode(node)
			? formatImportNode(directory, filename, node)
			: formatExportNode(directory, filename, string, node);
		return stringUtil.spliceString(string, range[0], range[1] - range[0], formatted);
	}, string);
}

function getUniqueElements(array) {
	return [...new Set(array)];
}

function getDirectImports(ast) {
	return getUniqueElements(ast.body.filter(isImportNode).map((node) => node.source.value));
}

// "Not functional". Yeah, whatever. A lot of organization needs
// to happen. And renaming. But I want to get this back to a functional point.
// Recursively get all imports.

// TODO: Only keep unique imports i.e. importing foo.js twice shouldn't
// result in two copies of foo.js in source code.

// TODO: Detect cyclic imports. Right now this function will probably
// recursive until it hits the maximum stack size if you have cyclic imports.
// Pass an extra parameter containing the history of modules that are importing
// this module and check for the same module. If it's there, then that means
// there is a loop in the dependency graph AKA cyclic import.

// Also, I'm using async but this isn't really very efficient.
// Like it should be done in parallel for there to actually be
// a performance boost. async/await doesn't magically do that.
async function getAllImports(rootDirectory, directory, ast) {
	const directImports = getDirectImports(ast);
	const allImports = [];
	for (const directImport of directImports) {
		if (directImport === "pjs") {
			continue;
		} // pjs is included by default, no need to worry about it.

		const normalizedPath = stringUtil.normalizePath(
			path.join(path.relative(rootDirectory, directory), path.normalize(directImport)),
		);
		const fullPath = path.join(rootDirectory, normalizedPath);
		const source = await fs.promises.readFile(fullPath, "utf-8");
		if (fullPath.endsWith(".json")) {
			// JSON files can also be imported! But make sure to
			// not parse them! :)
			allImports.push({ normalizedPath, source, ast: null });
		} else {
			const importAst = acorn.parse(source, acornConfig);
			allImports.push({ normalizedPath, source, ast: importAst });

			const nextImports = await getAllImports(rootDirectory, path.dirname(fullPath), importAst);
			allImports.push(...nextImports);
		}
	}
	return allImports;
}

async function bundleJS(directory, config) {
	// Use header.js or something to add code before anything else, like comments.
	// Should just work without configuration :)
	let mainSource;
	if (config.mode === "html") {
		try {
			// index.html is always directly under directory so this is fine.
			// AKA dirname(path of index.html) == directory
			mainSource = await fs.promises.readFile(path.join(directory, config.main), "utf-8");
		} catch (error) {
			return null;
		}
	} else {
		try {
			mainSource = await fs.promises.readFile(path.resolve(directory, "main.js"), "utf-8");
		} catch (error) {
			return null;
		}
	}

	const mainIndent = detectIndent(mainSource).indent || "    ";

	let ast;
	try {
		ast = acorn.parse(mainSource, acornConfig);
	} catch (error) {
		// TODO: What is the best way to report errors?
		console.error(`\x1b[91m[ERROR]\x1b[39m ${error.message} in ${config.main}`);
		return null;
	}

	const allImports = await getAllImports(directory, directory, ast);

	// TODO: If there are no imports, don't generate the module code.
	// Just return the main source code untransformed.

	const importSourceCode = allImports
		.map((importInfo) => {
			let transformed = transformSourceCode(
				directory,
				importInfo.normalizedPath,
				importInfo.source,
				importInfo.ast,
			);
			transformed = stringUtil.indent(transformed, mainIndent);
			return `addModule("${importInfo.normalizedPath}", function(__module__) {\n${transformed}\n});`;
		})
		.join("\n\n");

	const mainTransformed = transformSourceCode(directory, "main.js", mainSource, ast);

	if (config.mode === "html") {
		return (
			webpagePrefix +
			"\n\n" +
			importSourceCode +
			"\n\n" +
			`function main() {\n${stringUtil.indent(mainTransformed, mainIndent)}\n}\n\n` +
			webpageSuffix
		);
	}

	// Optionally add header.js file.
	let header = "";
	try {
		header = await fs.promises.readFile(path.join(directory, "header.js"), "utf-8");
		header += "\n";
	} catch (error) {}

	return (
		header +
		processingJsPrefix +
		"\n\n" +
		importSourceCode +
		"\n\n" +
		`function main() {\n${stringUtil.indent(mainTransformed, mainIndent)}\n}\n\n` +
		processingJsSuffix
	);
}

module.exports = async (directory, config) => {
	try {
		return await bundleJS(directory, config);
	} catch (error) {
		// TODO: Stop abusing try catch it makes it hard to find actual errors
		console.error(error);
		return null;
	}
};
