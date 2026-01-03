import pandas as pd
import pathlib
import json
import logging
from config import DATA_DIR, TARGET_WCA_IDS, OUT_DIR

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def load_small_tables():
    """Load small reference tables into memory."""
    tables = {}
    for name in ['competitions', 'events', 'formats', 'round_types', 'persons', 'countries']:
        logging.info(f"Loading {name}...")
        tables[name] = pd.read_csv(DATA_DIR / f"{name}.tsv", sep='\t')
    return tables

def extract_results(target_ids):
    """Stream results.tsv and filter for target IDs."""
    logging.info("Filtering results.tsv...")
    
    # We need to collect result_ids to filter result_attempts later
    # and we want to keep the filtered results
    
    filtered_results = []
    
    # Process in chunks because results.tsv is huge
    chunk_size = 100000
    results_path = DATA_DIR / "results.tsv"
    
    for chunk in pd.read_csv(results_path, sep='\t', chunksize=chunk_size):
        # Filter where personId is in our target list
        mask = chunk['person_id'].isin(target_ids)
        if mask.any():
            filtered_results.append(chunk[mask])
            
    if not filtered_results:
        logging.warning("No results found for target IDs.")
        return pd.DataFrame(), set()
        
    final_results = pd.concat(filtered_results)
    result_ids = set(final_results['id'])
    
    logging.info(f"Found {len(final_results)} results matching target IDs.")
    return final_results, result_ids

def extract_attempts(result_ids):
    """Stream result_attempts.tsv and filter by result_id."""
    logging.info("Filtering result_attempts.tsv...")
    
    filtered_attempts = []
    chunk_size = 100000
    attempts_path = DATA_DIR / "result_attempts.tsv"
    
    for chunk in pd.read_csv(attempts_path, sep='\t', chunksize=chunk_size):
        # Filter where resultId is in our set
        mask = chunk['result_id'].isin(result_ids)
        if mask.any():
            filtered_attempts.append(chunk[mask])
    
    if not filtered_attempts:
        return pd.DataFrame()
        
    final_attempts = pd.concat(filtered_attempts)
    logging.info(f"Found {len(final_attempts)} attempts matching results.")
    return final_attempts

def main():
    if not (DATA_DIR / "results.tsv").exists():
        logging.error("Data missing. Run 01_fetch_data.py first.")
        return

    # Create cache directory
    cache_dir = DATA_DIR / "cache"
    cache_dir.mkdir(exist_ok=True)
    
    # 1. Extract Results
    df_results, result_ids = extract_results(TARGET_WCA_IDS)
    if df_results.empty:
        return

    # 2. Extract Attempts
    df_attempts = extract_attempts(result_ids)
    
    # 3. Save to cache
    logging.info("Saving filtered data to cache...")
    df_results.to_parquet(cache_dir / "filtered_results.parquet", index=False)
    df_attempts.to_parquet(cache_dir / "filtered_attempts.parquet", index=False)
    
    # Also save small tables to quick access if needed, or we just load them from TSV in build_stats
    # For now, just ensuring they exist is enough.
    
    logging.info("Extraction complete.")

if __name__ == "__main__":
    main()
