# KaPack

## Summary

KaPack is a command line tool for packing separate files into a single file that can be copied into a Khan Academy program. The output preserves the indentation and format of the original source code, so it can be easily read by learners on KA.

## Usage

```
ka-pack <directory> [output]
```

ka-pack expects a root source file to exist in the directory. The name of the file is either `main.js` (for Processing.js programs), or `index.html` (for webpages). If both exist, the project is assumed to be a webpage and `index.html` is used.

Other files are found and included by `import` statements in JS files, `@import` statements in CSS, or `<link>` and `<script>` elements in HTML. JSON files can be `import`ed into JS files!

If a `header.js` file exists in the directory, and the current project is a Processing.js program, then the contents of the `header.js` file are prepended to the rest of the code. This is handy if you want to add comments, code, or anything else right at the top of your program with no interference.

If no output is provided, or if the output is `-`, then the combined code is written to standard output. Otherwise, a new file is created or overwritten.

If `-h` or `--help` option is provided, then the program prints the program's help message and exits.

If the `-v` or `--version` option is provided, then the program prints the current version number and exits.

## Building

There is no build procedure. Just run `npm install` and you can start using ka-pack.

## Installing

There isn't really an installation procedure either. If you want, you can add the `bin` directory to your `PATH`.

## Contributing

TODO
