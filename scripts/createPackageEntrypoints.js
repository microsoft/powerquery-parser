const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const libraryRoot = path.join(packageRoot, "lib", "powerquery-parser");
const templateLibraryRoot = path.join(libraryRoot, "localization", "templates");
const localePackageRoot = path.join(packageRoot, "locales");
const localizationTemplatesModule = "../lib/powerquery-parser/localization/templates";

fs.writeFileSync(path.join(packageRoot, "core.js"), 'module.exports = require("./lib/powerquery-parser/core");\n');
fs.writeFileSync(path.join(packageRoot, "core.d.ts"), 'export * from "./lib/powerquery-parser/core";\n');

fs.rmSync(localePackageRoot, { recursive: true, force: true });
fs.mkdirSync(localePackageRoot, { recursive: true });

for (const fileName of fs.readdirSync(templateLibraryRoot)) {
    const localeMatch = /^template(?:\.([^.]+))?\.json$/.exec(fileName);

    if (localeMatch === null) {
        continue;
    }

    const localeName = localeMatch[1] ?? "en-US";
    const relativeTarget = `../lib/powerquery-parser/localization/templates/${fileName}`;

    fs.writeFileSync(
        path.join(localePackageRoot, `${localeName}.js`),
        `exports.templates = require("${relativeTarget}");\n`,
    );
    fs.writeFileSync(
        path.join(localePackageRoot, `${localeName}.d.ts`),
        `import { ILocalizationTemplates } from "${localizationTemplatesModule}";\n\n` +
            "export const templates: ILocalizationTemplates;\n",
    );
}

fs.writeFileSync(
    path.join(localePackageRoot, "all.js"),
    `exports.Templates = require("${localizationTemplatesModule}");\n`,
);
fs.writeFileSync(
    path.join(localePackageRoot, "all.d.ts"),
    `export * as Templates from "${localizationTemplatesModule}";\n`,
);
