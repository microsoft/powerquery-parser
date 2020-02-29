import os
import shutil

LOCALIZATION_DROP_DIR = r""
POWERQUERY_PARSER_DIR = os.path.dirname(os.path.dirname(__file__))

for entry in os.scandir(LOCALIZATION_DROP_DIR):
    if not entry.is_dir():
        continue

    localization_code = os.path.basename(entry.path)
    localization_src = os.path.join(
        LOCALIZATION_DROP_DIR,
        localization_code,
        "src",
        "localization",
        "templates",
        "en-US.json"
    )

    if not os.path.isfile(localization_src):
        raise Exception("couldn't find localization file for {} at {}".format(localization_code))

    localization_dst = os.path.join(
        POWERQUERY_PARSER_DIR,
        "src",
        "localization",
        "templates",
        "{}.json".format(localization_code)
    )

    print("Copying {}".format(localization_code))
    shutil.copyfile(localization_src, localization_dst)
