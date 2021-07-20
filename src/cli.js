const bundle = require("./bundle.js");
const commandParser = require("./command_parser.js");
const fs = require("fs");

const bundleCommandConfig = {
	options: {
		version: {
			alias: ["v"],
			boolean: true,
			desc: "Print version of program and exit.",
		},
		help: {
			alias: ["h"],
			boolean: true,
			desc: "Print this message and exit.",
		},
	},
	positionals: ["path", "output"],
	positionalsDescs: ["Path of directory to bundle.", "Path of file to output bundle in or - for stdout."],
	name: "khan-bundle",
};
const command = commandParser(process.argv.slice(2), bundleCommandConfig);

if (command.options.help) {
	command.outputUsageMessage();
	process.exit(0);
}
if (command.options.version) {
	command.outputVersion("v0.1.0");
	process.exit(0);
}
if (command.outputPotentialErrors()) {
	process.exit(1);
}

const outputPath = command.positionals.output;
const outputStream = outputPath === "-" ? process.stdout : fs.createWriteStream(outputPath, "utf-8");

bundle(command.positionals.path).then((bundleString) => {
	outputStream.write(bundleString);
	if (outputStream !== process.stdout) {
		outputStream.close();
	}
});
