const stringWidth = require("string-width");
const term = require("./term.js");

function shallowCopy(object) {
	return Object.assign({}, object);
}

function flattenOptions(options) {
	options = shallowCopy(options);
	for (const [name, info] of Object.entries(options)) {
		if (!info.canonicalName) {
			// Add canonical name for all options.
			// Redundant but makes code simpler (only one possibility).
			info.canonicalName = name;
		}
		if (!Array.isArray(info.alias)) {
			continue;
		}
		for (const alias of info.alias) {
			options[alias] = Object.assign({}, info, { isAlias: true, canonicalName: name });
		}
	}
	return options;
}

class CommandParser {
	constructor(argv, config) {
		this.argv = argv;
		this.index = 0;

		this.config = shallowCopy(config);
		this.config.options = flattenOptions(config.options);

		this.options = {};
		this.positionals = [];
		this.errors = [];
	}

	peek() {
		const index = this.index,
			argv = this.argv;
		return index >= argv.length ? null : argv[index];
	}

	consume() {
		const index = this.index,
			argv = this.argv;
		return index >= argv.length ? null : argv[this.index++];
	}

	error(string) {
		this.errors.push(string);
	}

	getOptionConfig(name) {
		return this.config.options[name];
	}

	setOption(name, value) {
		const config = this.getOptionConfig(name);
		const canonicalName = config.canonicalName;
		if (config.format) {
			const formatCheck = config.format(value, config);
			if (formatCheck instanceof Error) {
				this.error(formatCheck.message);
				return;
			}
			this.options[canonicalName] = formatCheck;
			return;
		}
		this.options[canonicalName] = value;
	}

	parseShortOption() {
		let argument = this.consume().substring(1);
		if (argument.indexOf("=") >= 0) {
			this.error(`Cannot use = to assign value to short options -${argument}`);
			return;
		}
		while (argument.length > 0) {
			const char = argument[0];
			argument = argument.substring(1);

			const optionConfig = this.getOptionConfig(char);
			if (!optionConfig) {
				this.error(`Unknown option -${char}`);
				continue;
			}

			if (optionConfig.boolean) {
				this.options[optionConfig.canonicalName] = true;
				continue;
			}

			if (argument.length === 0) {
				if (!this.peek()) {
					this.error(`Expected value for option -${char}`);
					break;
				}
				this.setOption(optionConfig.canonicalName, this.consume());
			} else {
				this.setOption(optionConfig.canonicalName, argument);
				break;
			}
		}
	}

	parseLongOption() {
		const argument = this.consume().substring(2);
		if (argument.indexOf("=") >= 0) {
			const equalIndex = argument.indexOf("=");
			const optionName = argument.substring(0, equalIndex);
			if (optionName.length === 1) {
				this.error(`--${optionName} must use short option syntax`);
				return;
			}
			const optionValue = argument.substring(equalIndex + 1);

			const optionConfig = this.getOptionConfig(optionName);
			if (!optionConfig) {
				this.error(`Unknown option --${optionName}`);
				return;
			}

			if (optionConfig.boolean) {
				this.error(`Argument supplied for boolean option --${optionName}`);
				return;
			}

			this.setOption(optionConfig.canonicalName, optionValue);
			return;
		}

		if (argument.length === 1) {
			this.error(`--${argument} must use short option syntax`);
			return;
		}

		const optionConfig = this.getOptionConfig(argument);
		if (!optionConfig) {
			this.error(`Unknown option --${argument}`);
			return;
		}

		if (optionConfig.boolean) {
			this.options[optionConfig.canonicalName] = true;
			return;
		}

		if (!this.peek()) {
			this.error(`Expected value for option --${argument}`);
			return;
		}

		this.setOption(optionConfig.canonicalName, this.consume());
	}

	parse() {
		while (this.index < this.argv.length) {
			const argument = this.peek();
			if (argument === "--") {
				this.consume();
				break; // Stop parsing options.
			} else if (argument === "-") {
				// Don't confuse a single dash with an option.
				this.positionals.push(this.consume());
			} else if (argument[0] === "-" && argument[1] === "-") {
				this.parseLongOption();
			} else if (argument[0] === "-") {
				this.parseShortOption();
			} else {
				this.positionals.push(this.consume());
			}
		}

		const config = this.config;
		const positionals = this.positionals;

		// Anything left is a positional argument.
		positionals.push(...this.argv.slice(this.index));

		if (positionals.length !== config.positionals.length) {
			const plural = config.positionals.length !== 1;
			this.error(
				`Expected ${config.positionals.length} positional argument${plural ? "s" : ""} but found ${
					positionals.length
				}`,
			);
		}

		// Positional arguments already returned in array, but also
		// add named properties as well.
		for (let i = 0; i < config.positionals.length; i++) {
			positionals[config.positionals[i]] = positionals[i];
		}

		// Set defaults.
		for (const [key, value] of Object.entries(this.config.options)) {
			if (value.isAlias) {
				continue;
			}
			if (!("default" in value)) {
				continue;
			}
			if (!(key in this.options)) {
				this.options[key] = value.default;
			}
		}
	}
}

class Command {
	constructor(config, options, positionals, errors) {
		this.config = config;
		this.options = options;
		this.positionals = positionals;
		this.errors = errors;
	}

	outputPotentialErrors() {
		if (this.errors.length > 0) {
			let message = exports.generateErrorMessage(this.config, this.errors);
			message += "\n\n" + exports.generateUsageMessage(this.config);
			console.error(message);
			return true;
		}
		return false;
	}

	outputUsageMessage() {
		console.log(exports.generateUsageMessage(this.config));
	}

	outputVersion(version) {
		console.log(`${this.config.name} ${version}`);
	}
}

module.exports = (argv, config) => {
	const commandParser = new CommandParser(argv, config);
	commandParser.parse();
	return new Command(config, commandParser.options, commandParser.positionals, commandParser.errors);
};

module.exports.hideBin = (argv) => argv.slice(2);

function transpose(matrix) {
	return matrix[0].map((_, i) => {
		return matrix.map((_, j) => matrix[j][i]);
	});
}

function formatColumns(columns, padding) {
	const columnSizes = columns.map((column) => {
		return Math.max(...column.map((cell) => stringWidth(cell)));
	});
	const paddedColumns = columns.map((column, index) => {
		// No reason to pad the last column, nothing comes after it.
		if (index === columns.length - 1) {
			return column;
		}
		return column.map((row) => {
			return row + " ".repeat(columnSizes[index] - stringWidth(row) + padding);
		});
	});
	const rows = transpose(paddedColumns);
	return rows.map((row) => row.join("")).join("\n");
}

exports.generateUsageMessage = (config) => {
	let string = "";

	const positionalNames = config.positionals.join(" ");
	string += `${term.heading("Usage:")} ${config.name} [options] ${positionalNames}\n\n`;

	const indent = " ".repeat(2);

	const optionText = Object.entries(config.options).map(([name, config]) => {
		const alias = config.alias || [];
		const names = [name]
			.concat(alias)
			.map((name) => (name.length === 1 ? "-" : "--") + name)
			.join(",");
		return [indent + names, config.desc];
	});
	string += term.heading("Options:") + "\n";
	string += formatColumns(transpose(optionText), 2) + "\n\n";

	const positionalText = config.positionals.map((pos, index) => {
		return [indent + pos, config.positionalsDescs[index]];
	});
	string += term.heading("Positionals:") + "\n";
	string += formatColumns(transpose(positionalText), 2);

	return string;
};

exports.generateErrorMessage = (config, errors) => {
	return errors.map((error) => `${config.name}: ${term.error("Error")}: ${error}`).join("\n");
};
