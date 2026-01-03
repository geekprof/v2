import pandas as pd
import pathlib
import json
import logging
from config import DATA_DIR, OUT_DIR

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def load_data():
    cache_dir = DATA_DIR / "cache"
    logging.info("Loading filtered data from cache...")
    try:
        results = pd.read_parquet(cache_dir / "filtered_results.parquet")
        comps = pd.read_csv(DATA_DIR / "competitions.tsv", sep='\t')
        return results, comps
    except FileNotFoundError:
        logging.error("Cache not found. Run 02_extract_wca_v2.py first.")
        return None, None

def build_map_data(results, comps):
    logging.info("Building map data...")
    
    # Get distinct competitions that our filtered users participated in
    visited_comp_ids = results['competition_id'].unique()
    
    # Filter comps table
    relevant_comps = comps[comps['id'].isin(visited_comp_ids)].copy()
    
    # Process Coordinates
    # WCA uses microdegrees. Divide by 1e6.
    relevant_comps['lat'] = relevant_comps['latitude_microdegrees'] / 1_000_000
    relevant_comps['lon'] = relevant_comps['longitude_microdegrees'] / 1_000_000
    
    # Process Dates (Handle end_date like before)
    relevant_comps['end_year'] = relevant_comps['end_year'].fillna(relevant_comps['year'])
    relevant_comps['end_month'] = relevant_comps['end_month'].fillna(relevant_comps['month'])
    relevant_comps['end_day'] = relevant_comps['end_day'].fillna(relevant_comps['day'])
    relevant_comps['end_date'] = pd.to_datetime(relevant_comps[['end_year', 'end_month', 'end_day']].rename(columns={'end_year': 'year', 'end_month': 'month', 'end_day': 'day'}))
    
    # 1. Index Competitions JSON
    index_comps = {}
    for _, row in relevant_comps.iterrows():
        index_comps[row['id']] = {
            "name": row['name'],
            "city": row['city_name'],
            "countryId": row['country_id'],
            "dateEnd": str(row['end_date'].date()),
            "lat": row['lat'],
            "lon": row['lon']
        }
        
    with open(OUT_DIR / "index_competitions.json", "w") as f:
        json.dump(index_comps, f, indent=2)
        
    # 2. GeoJSON
    features = []
    
    # We want to list participants for each competition
    # Group results by comp_id
    res_grouped = results.groupby('competition_id')
    
    for _, row in relevant_comps.iterrows():
        comp_id = row['id']
        
        participants = []
        events_present = []
        
        if comp_id in res_grouped.groups:
            group = res_grouped.get_group(comp_id)
            # Get unique names
            # We select person_name where person_id is unique to avoid duplicates
            participants = group[['person_name']].drop_duplicates()['person_name'].tolist()
            events_present = list(group['event_id'].unique())
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row['lon'], row['lat']] # GeoJSON is [lon, lat]
            },
            "properties": {
                "compId": comp_id,
                "name": row['name'],
                "city": row['city_name'],
                "dateEnd": str(row['end_date'].date()),
                "participants": participants,
                "events": events_present
            }
        }
        features.append(feature)
        
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(OUT_DIR / "map_competitions.geojson", "w") as f:
        json.dump(geojson, f, indent=2)
        
    logging.info(f"Generated map data for {len(relevant_comps)} competitions.")

def main():
    results, comps = load_data()
    if results is None: return
    
    build_map_data(results, comps)

if __name__ == "__main__":
    main()
