import os
import psycopg2


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "postgres"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "pyroclass"),
    "user": os.getenv("DB_USER", "pyroclass"),
    "password": os.getenv("DB_PASSWORD", "pyroclass123"),
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)