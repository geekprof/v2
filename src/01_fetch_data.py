import requests
import zipfile
import io
import json
import logging
from datetime import datetime
from config import DATA_DIR, WCA_EXPORT_API_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_latest_export_metadata():
    logging.info("Checking for latest WCA export...")
    try:
        response = requests.get(WCA_EXPORT_API_URL)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.error(f"Failed to fetch metadata: {e}")
        return None

def download_and_extract(url, export_date):
    logging.info(f"Downloading WCA export from {url}...")
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            
            with io.BytesIO() as f_mem:
                downloaded = 0
                for chunk in r.iter_content(chunk_size=8192):
                    f_mem.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0 and downloaded % (1024*1024*10) == 0: # Log every 10MB
                        logging.info(f"Downloaded {downloaded/1024/1024:.1f} MB / {total_size/1024/1024:.1f} MB")
                
                logging.info("Download complete. Extracting TSV files...")
                with zipfile.ZipFile(f_mem) as z:
                    # Mapping of zip content names to target filenames
                    file_mapping = {
                        'WCA_export_competitions.tsv': 'competitions.tsv',
                        'WCA_export_results.tsv': 'results.tsv',
                        'WCA_export_result_attempts.tsv': 'result_attempts.tsv',
                        'WCA_export_persons.tsv': 'persons.tsv',
                        'WCA_export_events.tsv': 'events.tsv',
                        'WCA_export_formats.tsv': 'formats.tsv',
                        'WCA_export_round_types.tsv': 'round_types.tsv',
                        'WCA_export_countries.tsv': 'countries.tsv',
                        'metadata.json': 'metadata.json'
                    }
                    
                    for file_info in z.infolist():
                        base_name = file_info.filename.split('/')[-1]
                        if base_name in file_mapping:
                            target_name = file_mapping[base_name]
                            file_info.filename = target_name
                            z.extract(file_info, DATA_DIR)
                            logging.info(f"Extracted {base_name} as {target_name}")

        # Update marker file
        with open(DATA_DIR / ".last_download", "w") as f:
            f.write(export_date)
        logging.info(f"Successfully updated WCA data to version {export_date}")
        
    except Exception as e:
        logging.error(f"Download/Extraction failed: {e}")

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    metadata = get_latest_export_metadata()
    if not metadata:
        return

    export_date = metadata['export_date']
    tsv_url = metadata['tsv_url']
    
    # Check if we already have this version
    last_download_file = DATA_DIR / ".last_download"
    if last_download_file.exists():
        with open(last_download_file, "r") as f:
            last_date = f.read().strip()
        if last_date == export_date:
            logging.info("Local data is up to date.")
            return

    logging.info(f"New version available: {export_date}")
    download_and_extract(tsv_url, export_date)

if __name__ == "__main__":
    main()
