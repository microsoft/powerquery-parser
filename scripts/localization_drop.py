import os
import shutil

LOCALIZATION_DIR = r"\\simpleloc\drops\Drops\PowerQuery_parser_2490\"
POWERQUERY_PARSER_DIR = os.path.dirname(os.path.dirname(__file__))

latest_dir = None
for entry in os.scandir(LOCALIZATION_DIR):
    if not entry.is_dir():
        continue
    elif latest_dir is None or latest_dir < entry:
        latest_dir = entry

assert latest_dir is not None

LOCALIZATION_DROP_DIR = os.path.join(
    latest_dir,
    "BinDrops",
    "Windows",
    "bin",
)

for entry in os.scandir(LOCALIZATION_DROP_DIR):
    if not entry.is_dir():
        continue

    localization_code = os.path.basename(entry.path)
    if localization_code == "qps-ploc":
        continue

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
