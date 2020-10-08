# This script pulls in the artifacts from the Azure Pipeline `powerquery-parser-1loc`
# and will update the localization templates under `..\src\localization\templates`.

import os
import shutil
import sys

if len(sys.argv) == 1:
    raise Exception("Expected a single command line argument which points to the artifacts from the `powerquery-parser-1loc` pipeline.")
elif len(sys.argv) > 2:
    raise Exception("Expected a single command line argument.")

LOCALIZATION_DROP_DIR = sys.argv[1]
LOCALIZATION_DIR = os.path.join(LOCALIZATION_DROP_DIR, "loc")
POWERQUERY_PARSER_DIR = os.path.abspath(os.path.join(
    "..",
    os.path.dirname(os.path.dirname(__file__)),
))

for entry in os.scandir(LOCALIZATION_DIR):
    # Ignore files.
    if not entry.is_dir():
        continue

    # There are a few build artifact folders we want to ignore.
    localization_code = os.path.basename(entry.path)
    if localization_code in ("ResponseFiles", "en"):
        continue

    # Create the filepath to where we expect the translated file to be at,
    # and error out if it doesn't exist.
    localization_src = os.path.join(
        LOCALIZATION_DIR,
        localization_code,
        "src",
        "localization",
        "templates",
        "en-US.json"
    )
    if not os.path.isfile(localization_src):
        raise Exception("couldn't find localization file for {} at {}".format(localization_code, localization_src))

    # Create the filepath to where we expect the translated file to be placed.
    localization_dst = os.path.join(
        POWERQUERY_PARSER_DIR,
        "src",
        "localization",
        "templates",
        "{}.json".format(localization_code)
    )

    print("Copying {}\n\tsrc={}\n\tdst={}".format(localization_code, localization_src, localization_dst))
    shutil.copyfile(localization_src, localization_dst)
