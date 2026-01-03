import pandas as pd
import pathlib
import json
import logging
from config import DATA_DIR, OUT_DIR, TARGET_WCA_IDS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def format_time(centiseconds):
    """Convert centiseconds to mm:ss.xx format."""
    if centiseconds == -1: return "DNF"
    if centiseconds == -2: return "DNS"
    if centiseconds == 0: return ""
    
    total_seconds = centiseconds / 100
    minutes = int(total_seconds // 60)
    seconds = total_seconds % 60
    
    if minutes > 0:
        return f"{minutes}:{seconds:05.2f}"
    else:
        return f"{seconds:.2f}"

def load_data():
    cache_dir = DATA_DIR / "cache"
    logging.info("Loading filtered data from cache...")
    try:
        results = pd.read_parquet(cache_dir / "filtered_results.parquet")
        attempts = pd.read_parquet(cache_dir / "filtered_attempts.parquet")
        
        # Load competitions and events for metadata
        comps = pd.read_csv(DATA_DIR / "competitions.tsv", sep='\t')
        events = pd.read_csv(DATA_DIR / "events.tsv", sep='\t')
        persons = pd.read_csv(DATA_DIR / "persons.tsv", sep='\t')
        round_types = pd.read_csv(DATA_DIR / "round_types.tsv", sep='\t')
        
        return results, attempts, comps, events, persons, round_types
    except FileNotFoundError:
        logging.error("Cache not found. Run extract_wca_v2.py first.")
        return None, None, None, None, None

def build_person_index(results, persons_df):
    """Build index_persons.json"""
    logging.info("Building person index...")
    
    # Get unique person IDs from results
    active_ids = results['person_id'].unique()
    
    # Filter persons table (persons table has multiple rows per person for sub-ids, take latest)
    # We can just take distinct by wca_id
    filtered_persons = persons_df[persons_df['wca_id'].isin(active_ids)].drop_duplicates(subset=['wca_id'])
    
    index_list = []
    for _, row in filtered_persons.iterrows():
        person_id = row['wca_id']
        # Get all events this person has competed in
        person_events = results[results['person_id'] == person_id]['event_id'].unique().tolist()
        
        index_list.append({
            "personId": person_id,
            "name": row['name'],
            "countryId": row['country_id'],
            "events": sorted(person_events)  # Sort for consistency
        })
        
    out_file = OUT_DIR / "index_persons.json"
    with open(out_file, "w") as f:
        json.dump(index_list, f, indent=2)

def build_stats(results, attempts, comps, round_types):
    """Build timeline and rounds stats."""
    
    # Merge results with competition info for dates
    # competition_id in results -> id in comps
    # We need start_date/end_date from comps
    
    # Process competitions data to create date fields
    comps['start_date'] = pd.to_datetime(comps[['year', 'month', 'day']])
    comps['end_year'] = comps['end_year'].fillna(comps['year'])
    comps['end_month'] = comps['end_month'].fillna(comps['month'])
    comps['end_day'] = comps['end_day'].fillna(comps['day'])
    comps['end_date'] = pd.to_datetime(comps[['end_year', 'end_month', 'end_day']].rename(columns={'end_year': 'year', 'end_month': 'month', 'end_day': 'day'}))
    
    results = results.merge(comps[['id', 'name', 'start_date', 'end_date', 'city_name']], 
                           left_on='competition_id', right_on='id', suffixes=('', '_comp'))
    
    # Merge with round types to get rank and name for sorting and display
    results = results.merge(round_types[['id', 'rank', 'name']], 
                           left_on='round_type_id', right_on='id', suffixes=('', '_rt'))
    
    # Process per person
    for person_id, person_group in results.groupby('person_id'):
        logging.info(f"Processing stats for {person_id}...")
        
        per_person_dir = OUT_DIR / "stats" / person_id
        
        # Process per event
        for event_id, event_group in person_group.groupby('event_id'):
            event_dir = per_person_dir / event_id
            event_dir.mkdir(parents=True, exist_ok=True)
            
            # --- TIMELINE DATA ---
            timeline_points = []
            
            # Group by competition to find best single/avg of the comp
            # Sort competitions by date
            # To ensure correct ordering, we aggregate first, then sort the aggregated results
            
            comp_stats = []
            
            for comp_id, comp_group in event_group.groupby('competition_id'):
                comp_meta = comp_group.iloc[0]
                valid_singles = comp_group[comp_group['best'] > 0]['best']
                valid_avgs = comp_group[comp_group['average'] > 0]['average']
                
                if valid_singles.empty: continue
                
                # Sort rounds in this comp by rank
                comp_group_sorted = comp_group.sort_values('rank')
                rounds_detail = []
                for _, r_row in comp_group_sorted.iterrows():
                    rounds_detail.append({
                        "name": r_row['name_rt'],
                        "single": format_time(r_row['best']),
                        "avg": format_time(r_row['average']) if r_row['average'] > 0 else "-",
                        "pos": int(r_row['pos'])
                    })

                # Get final rank from the furthest round reached
                final_pos = comp_group_sorted.iloc[-1]['pos']
                
                comp_stats.append({
                    "meta": comp_meta,
                    "bestSingle": valid_singles.min(),
                    "bestAvg": valid_avgs.min() if not valid_avgs.empty else None,
                    "dateEnd": comp_meta['end_date'],
                    "len": len(comp_group),
                    "compId": comp_id,
                    "finalPos": int(final_pos),
                    "rounds": rounds_detail
                })
                
            # Sort by date
            comp_stats.sort(key=lambda x: x['dateEnd'])
            
            # Now Build Timeline with PRs
            best_single_so_far = float('inf')
            best_avg_so_far = float('inf')
            
            for stat in comp_stats:
                is_pr_single = False
                is_pr_avg = False
                
                if stat['bestSingle'] < best_single_so_far:
                    best_single_so_far = stat['bestSingle']
                    is_pr_single = True
                    
                if stat['bestAvg'] and stat['bestAvg'] < best_avg_so_far:
                    best_avg_so_far = stat['bestAvg']
                    is_pr_avg = True
                    
                timeline_points.append({
                    "compId": stat['compId'],
                    "compName": stat['meta']['name'],
                    "dateEnd": str(stat['dateEnd'].date()),
                    "bestSingleCs": int(stat['bestSingle']),
                    "bestAvgCs": int(stat['bestAvg']) if stat['bestAvg'] else None,
                    "bestSingleText": format_time(stat['bestSingle']),
                    "bestAvgText": format_time(stat['bestAvg']) if stat['bestAvg'] else "-",
                    "isPRSingle": is_pr_single,
                    "isPRAvg": is_pr_avg,
                    "finalPos": stat['finalPos'],
                    "rounds": stat['rounds'],
                    "roundsCount": stat['len']
                })
            
            with open(event_dir / "timeline.json", "w") as f:
                json.dump({"personId": person_id, "eventId": event_id, "points": timeline_points}, f, indent=2)
                
            # --- ROUNDS DATA ---
            rounds_list = []
            
            # For attempts, we need to join with the attempts df
            # Filter attempts for these results
            relevant_result_ids = event_group['id'].unique()
            relevant_attempts = attempts[attempts['result_id'].isin(relevant_result_ids)]
            
            # Merge attempts with results to know which round it belongs to
            # But actually we iterate rounds (rows in event_group)
            
            # Sort rounds within event group by competition date then round type rank
            # We use start_date for competitions and rank for rounds
            event_group = event_group.sort_values(['start_date', 'rank'])

            for _, row in event_group.iterrows():
                # Get attempts for this result
                res_attempts = relevant_attempts[relevant_attempts['result_id'] == row['id']]
                res_attempts = res_attempts.sort_values('attempt_number')
                
                attempts_values = []
                attempts_text = []
                
                # Create a list of 5 attempts (padding if necessary/checking format)
                # But simple list is usually fine for JSON
                for _, att in res_attempts.iterrows():
                    val = att['value']
                    attempts_values.append(int(val))
                    attempts_text.append(format_time(val))
                
                rounds_list.append({
                    "compId": row['competition_id'],
                    "compName": row['name'],
                    "date": str(row['end_date'].date()), # Approximate date of round
                    "roundTypeId": row['round_type_id'],
                    "roundName": row['name_rt'],
                    "formatId": row['format_id'],
                    "pos": int(row['pos']),
                    "attemptsCs": attempts_values,
                    "attemptsText": attempts_text,
                    "bestCs": int(row['best']),
                    "avgCs": int(row['average']),
                    "bestText": format_time(row['best']),
                    "avgText": format_time(row['average'])
                })
                
            with open(event_dir / "rounds.json", "w") as f:
                json.dump({"personId": person_id, "eventId": event_id, "rounds": rounds_list}, f, indent=2)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    results, attempts, comps, events, persons, round_types = load_data()
    if results is None: return
    
    build_person_index(results, persons)
    build_stats(results, attempts, comps, round_types)
    logging.info("Stats build complete.")

if __name__ == "__main__":
    main()
