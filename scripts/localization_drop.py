import os
import shutil
import sys

LOCALIZATION_DIR = r"\\simpleloc\drops\Drops\PowerQuery_parser_2490"
POWERQUERY_PARSER_DIR = os.path.join(
    "..",
    os.path.dirname(os.path.dirname(__file__)),
)

latest_dir = None
for entry in os.scandir(LOCALIZATION_DIR):
    if not entry.is_dir():
        continue
    elif latest_dir is None or latest_dir.name < entry.name:
        latest_dir = entry

assert latest_dir is not None

with open("localization_drop", "r") as f:
    if f.read() == latest_dir.name:
        print("Already picked up {}, exiting.".format(latest_dir.name))
        sys.exit(0)

print("Picking up a new version, {}".format(latest_dir.name))

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

    print("Copying {}\n\tsrc={}\n\tdst={}".format(localization_code, localization_src, localization_dst))
    shutil.copyfile(localization_src, localization_dst)

with open("localization_drop", "w") as f:
    f.write(latest_dir.name)