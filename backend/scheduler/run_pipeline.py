"""
Scheduled pipeline runner — ties together live FIRMS ingestion, spatial
matching, and OSM enrichment into one job that runs safely, unattended,
on a schedule.

"Defensive" here means concretely:
  - each step is wrapped so one failure doesn't kill the others
  - every step logs what happened, with a timestamp
  - the whole run reports a clear pass/fail summary at the end

Run once, manually, to test:
    python backend/scheduler/run_pipeline.py --once

Run as a long-lived scheduled process (polls every N hours):
    python backend/scheduler/run_pipeline.py
"""
import argparse
import logging
import subprocess
import sys

from apscheduler.schedulers.blocking import BlockingScheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

POLL_INTERVAL_HOURS = 6  # matches realistic FIRMS revisit frequency, not "real-time"

STEPS = [
    ("Live FIRMS ingestion", ["python", "backend/ingestion/live_firms_pull.py"]),
    ("Spatial matching", ["docker", "compose", "exec", "-T", "postgres",
                           "psql", "-U", "pyroclass", "-d", "pyroclass",
                           "-f", "/dev/stdin"]),  # fed the SQL file's content via stdin below
    ("OSM enrichment", ["python", "backend/ingestion/osm_enrich_live.py"]),
]


def run_step(name, command, stdin_file=None):
    """Run one pipeline step. Returns True on success, False on failure —
    never raises, so one bad step doesn't stop the rest of the run."""
    log.info(f"Starting: {name}")
    try:
        stdin_data = None
        if stdin_file:
            with open(stdin_file, "rb") as f:
                stdin_data = f.read()

        result = subprocess.run(
            command,
            input=stdin_data,
            capture_output=True,
            timeout=300,  # 5 min ceiling per step — a hung step shouldn't hang forever
        )

        if result.returncode != 0:
            log.error(f"FAILED: {name} (exit code {result.returncode})")
            log.error(result.stderr.decode(errors="replace")[:1000])
            return False

        log.info(f"OK: {name}")
        return True

    except subprocess.TimeoutExpired:
        log.error(f"TIMEOUT: {name} took longer than 5 minutes, skipped")
        return False
    except Exception as e:
        log.error(f"UNEXPECTED ERROR in {name}: {e}")
        return False


def run_pipeline():
    log.info("=== Pipeline run starting ===")
    results = {}

    results["ingestion"] = run_step(
        "Live FIRMS ingestion", ["python", "backend/ingestion/live_firms_pull.py"]
    )
    results["matching"] = run_step(
        "Spatial matching",
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "pyroclass", "-d", "pyroclass"],
        stdin_file="backend/migrations/006_real_spatial_match.sql",
    )
    results["enrichment"] = run_step(
        "OSM enrichment", ["python", "backend/ingestion/osm_enrich_live.py"]
    )

    succeeded = sum(results.values())
    log.info(f"=== Pipeline run finished: {succeeded}/{len(results)} steps succeeded ===")
    for step, ok in results.items():
        log.info(f"  {step}: {'OK' if ok else 'FAILED'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run once and exit, don't schedule")
    args = parser.parse_args()

    if args.once:
        run_pipeline()
        sys.exit(0)

    scheduler = BlockingScheduler()
    scheduler.add_job(run_pipeline, "interval", hours=POLL_INTERVAL_HOURS)
    log.info(f"Scheduler started — running every {POLL_INTERVAL_HOURS} hours. Ctrl+C to stop.")
    run_pipeline()  # run once immediately on startup, then wait for the interval
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")
