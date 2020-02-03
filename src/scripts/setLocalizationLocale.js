var path = require("path");
const fs = require("fs");

if (process.argv.length !== 2 && process.argv.length !== 3) {
    throw new Error("Expected process.argv.length to be 2 or 3");
}

const potentialLocale = process.argv.length == 3 ? process.argv[2] : "en-US";

const maybeSrcFilename = potentialLocale + ".json";

const localizationFolder = path.join(
    // powerquery-parser\src\scripts
    __dirname,
    // src
    "..",
    "localization",
);
const maybeSrcFilepath = path.join(localizationFolder, "templates", maybeSrcFilename);

if (!fs.existsSync(maybeSrcFilepath)) {
    throw new Error("Unknown template file: " + maybeSrcFilepath);
}

const dstFilepath = path.join(localizationFolder, "templates.json");

fs.copyFile(maybeSrcFilepath, dstFilepath, err => {
    if (err) {
        throw err;
    } else {
        console.log(`Build locale set to ${potentialLocale}`);
    }
});
