import pandas as pd
import pathlib

DATA_DIR = pathlib.Path("data")

def debug_sorting(person_id, event_id):
    cache_dir = DATA_DIR / "cache"
    results = pd.read_parquet(cache_dir / "filtered_results.parquet")
    comps = pd.read_csv(DATA_DIR / "competitions.tsv", sep='\t')
    round_types = pd.read_csv(DATA_DIR / "round_types.tsv", sep='\t')
    
    comps['start_date'] = pd.to_datetime(comps[['year', 'month', 'day']])
    results = results.merge(comps[['id', 'name', 'start_date']], left_on='competition_id', right_on='id')
    results = results.merge(round_types[['id', 'rank', 'name']], left_on='round_type_id', right_on='id', suffixes=('', '_rt'))
    
    subset = results[(results['person_id'] == person_id) & (results['event_id'] == event_id)]
    subset = subset.sort_values(['start_date', 'rank'])
    
    print(f"Rounds for {person_id} in {event_id}:")
    for _, row in subset.iterrows():
        print(f"{row['start_date'].date()} | {row['name']} | {row['name_rt']} (rank {row['rank']})")

if __name__ == "__main__":
    debug_sorting("2025GELY01", "333")
