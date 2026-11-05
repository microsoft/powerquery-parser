// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

const Mocha = require("mocha");

module.exports = class MultiReporter {
    constructor(runner, options) {
        new Mocha.reporters.Spec(runner, options);
        new Mocha.reporters.XUnit(runner, options);
    }
};
