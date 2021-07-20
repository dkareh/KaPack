try {
    main(); // An error could occur, such as an invalid module name error.
} catch (error) {
    env.draw = env.noop; // The draw function may overwrite the console information.

    env.println("Error in module: " + __currentModuleName__);
    env.println(error);
    env.debug(error); // Outputting to the console may reveal more information.
}