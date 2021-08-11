# KaPack

## Examples

This directory contains files that can be used to build example Khan Academy (KA) projects. Once the code is bundled, it can be copied into a new PJS or webpage project on KA.

Each example can be tried by just running `ka-pack` and specifying the path to the corresponding directory.

## Notes

`whatever.js` is actually an obsolete example since KaPack only bundles directories containing content. KaPack only accepts paths to directories containing the files that need to be bundled.

In the future, we should let users specify paths to single files, either to be synced with no modifications, or as an alternative way of specifying the root source file.
