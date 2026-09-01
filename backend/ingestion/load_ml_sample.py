import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
import sys

DB_DSN = os.getenv("DATABASE_URL", "postgresql://pyroclass:pyroclass123@127.0.0.1:5432/pyroclass")
CSV_PATH = r"c:\Github\pyroclass\PyroClass_Final_Artifacts\viirs-jpss1_2024_India_firms_stage4_pseudo_labelled.csv"

def load_sample():
    print(f"Loading data from {CSV_PATH}...")
    # Read the full dataset but we will sample it
    df = pd.read_csv(CSV_PATH)
    print(f"Total rows in CSV: {len(df)}")
    
    # Stratified sample by label_name
    # We want a mix of classes. Let's take 500 from each of the 4 classes to get a nice 2000 row sample.
    sample_df = df.groupby('label_name').apply(lambda x: x.sample(n=min(len(x), 500), random_state=42)).reset_index(drop=True)
    
    print(f"Sampled {len(sample_df)} rows. Distribution:")
    print(sample_df['label_name'].value_counts())
    
    try:
        sql_file = "insert_sample.sql"
        print(f"Generating {sql_file}...")
        
        with open(sql_file, "w", encoding="utf-8") as f:
            f.write("DELETE FROM classifications;\n")
            f.write("DELETE FROM hotspots;\n\n")
            
            # Prepare data for insertion
            columns = [
                "latitude", "longitude", "geometry", "timestamp", "frp", "bright_ti4", "bright_ti5", 
                "confidence", "daynight", "scan", "track", "acq_hour", "thermal_difference", 
                "thermal_ratio", "pixel_area", "frp_per_pixel_area", "detections_7d", "detections_30d", 
                "active_days_90d", "active_day_ratio_90d", "frp_mean_90d", "frp_ratio_to_90d_mean", 
                "time_since_previous_detection", "distance_to_refinery", "refinery_within_1km", 
                "refinery_within_5km", "distance_to_power_plant", "power_plant_within_1km", 
                "power_plant_within_5km", "distance_to_industrial_works", "industrial_works_within_1km", 
                "industrial_works_within_5km", "distance_to_industrial_area", "industrial_area_within_1km", 
                "industrial_area_within_5km", "distance_to_quarry", "quarry_within_1km", "quarry_within_5km", 
                "distance_to_mine", "mine_within_1km", "mine_within_5km", "distance_to_nearest_industrial", 
                "industrial_within_1km", "industrial_within_5km", "distance_to_forest", "forest_within_1km", 
                "forest_within_5km", "distance_to_farmland", "farmland_within_1km", "farmland_within_5km", 
                "label", "label_name", "case_id"
            ]
            
            f.write(f"INSERT INTO hotspots ({', '.join(columns)}) VALUES \n")
            
            values = []
            for i, row in sample_df.iterrows():
                row = row.fillna(0) # naive fill for missing floats
                
                lat = row['latitude']
                lon = row['longitude']
                geom = f"ST_GeomFromText('POINT({lon} {lat})', 4326)"
                
                conf = row['confidence']
                if conf == 'l': conf = 10.0
                elif conf == 'n': conf = 50.0
                elif conf == 'h': conf = 100.0
                else: conf = 50.0
                
                # Format values
                vals = [
                    f"{lat}", f"{lon}", geom, f"'{row['acq_datetime']}'", f"{row['frp']}", f"{row['bright_ti4']}", f"{row['bright_ti5']}",
                    f"{conf}", f"'{row['daynight']}'", f"{row['scan']}", f"{row['track']}", f"{row['acq_hour']}", f"{row['thermal_difference']}",
                    f"{row['thermal_ratio']}", f"{row['pixel_area']}", f"{row['frp_per_pixel_area']}", f"{row['detections_7d']}", f"{row['detections_30d']}",
                    f"{row['active_days_90d']}", f"{row['active_day_ratio_90d']}", f"{row['frp_mean_90d']}", f"{row['frp_ratio_to_90d_mean']}",
                    f"{row['time_since_previous_detection']}", f"{row['distance_to_refinery']}", f"{row['refinery_within_1km']}",
                    f"{row['refinery_within_5km']}", f"{row['distance_to_power_plant']}", f"{row['power_plant_within_1km']}",
                    f"{row['power_plant_within_5km']}", f"{row['distance_to_industrial_works']}", f"{row['industrial_works_within_1km']}",
                    f"{row['industrial_works_within_5km']}", f"{row['distance_to_industrial_area']}", f"{row['industrial_area_within_1km']}",
                    f"{row['industrial_area_within_5km']}", f"{row['distance_to_quarry']}", f"{row['quarry_within_1km']}", f"{row['quarry_within_5km']}",
                    f"{row['distance_to_mine']}", f"{row['mine_within_1km']}", f"{row['mine_within_5km']}", f"{row['distance_to_nearest_industrial']}",
                    f"{row['industrial_within_1km']}", f"{row['industrial_within_5km']}", f"{row['distance_to_forest']}", f"{row['forest_within_1km']}",
                    f"{row['forest_within_5km']}", f"{row['distance_to_farmland']}", f"{row['farmland_within_1km']}", f"{row['farmland_within_5km']}",
                    f"{row['label']}", f"'{row['label_name']}'", f"'ML_SAMPLE_{i:04d}'"
                ]
                values.append("(" + ", ".join(vals) + ")")
                
            f.write(",\n".join(values) + ";\n")
            
        print("SQL file generated successfully.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    load_sample()
