import pathlib

# WCA IDs to track
TARGET_WCA_IDS = [
    "2024GELY01",
    "2025GELY01",
    "2024BERT02",
    "2024DORO01",
    "2023MFOU01"
]

# Paths
BASE_DIR = pathlib.Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "out"
SRC_DIR = BASE_DIR / "src"

# WCA API
WCA_EXPORT_API_URL = "https://www.worldcubeassociation.org/api/v0/export/public"
