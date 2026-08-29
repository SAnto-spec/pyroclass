# SIH26162 --- PyroClass

## Canonical Prototype & Implementation Blueprint

### AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data

**Status:** Canonical baseline for implementation and AI-assisted
coding\
**Prototype geography:** **India only**\
**Primary prototype name:** **PyroClass**\
**Primary model:** **XGBoost multi-class classifier**\
**Explainability:** **SHAP TreeExplainer**\
**Primary thermal source:** **NASA FIRMS VIIRS**\
**Primary spatial context:** **OpenStreetMap + land-cover data +
optional satellite imagery**\
**Primary prototype objective:** Demonstrate accurate, explainable
classification of carefully selected thermal hotspots across India, with
a GIS map overlay and a curated 20-point demonstration set.

> **Important:** This document is the implementation baseline. Future
> coding agents should treat the sections titled **MUST**, **SHOULD**,
> **Prototype Decision**, **Non-Goal**, and **Acceptance Criteria** as
> constraints. Do not silently replace the architecture with a simpler
> "fire detector" or train only on raw FIRMS columns.

------------------------------------------------------------------------

# 1. Executive Summary

## 1.1 The problem in one sentence

NASA FIRMS detects thermal anomalies from space, but a hotspot alone
does not explain **what is causing the heat**. SIH26162 asks for an
AI-enabled geospatial system that combines thermal detections with
contextual geospatial information to distinguish industrial fires and
persistent industrial thermal sources from natural and other thermal
activity.

## 1.2 What PyroClass will build

PyroClass will ingest historical and recent thermal hotspot detections
for **India**, enrich every hotspot with spatial and temporal context,
classify it, estimate abnormality/risk, explain the decision, and
visualize the result on an interactive GIS dashboard.

The core flow is:

``` text
NASA FIRMS thermal hotspot
          +
Historical detections
          +
Industrial infrastructure
          +
Land-cover context
          +
Optional satellite imagery
          |
          v
Geospatial + temporal feature engineering
          |
          v
XGBoost classification
          |
          +-------------------+
          |                   |
          v                   v
Confidence / probabilities   SHAP explanation
          |
          v
Anomaly / priority scoring
          |
          v
FastAPI + PostGIS
          |
          v
Interactive India GIS dashboard
```

## 1.3 Prototype-specific goal

The prototype will **not attempt to operationally monitor the whole
world**. It will focus on **India only** and demonstrate the complete
pipeline through a curated **20-point prototype set** containing
representative examples of:

-   normal persistent industrial heat,
-   abnormal industrial spikes,
-   non-industrial thermal activity,
-   forest/vegetation fires,
-   agricultural burning,
-   ambiguous or unknown detections.

The 20 points are a **demo/evaluation set**, not the complete training
dataset.

------------------------------------------------------------------------

# 2. Official Problem Statement Interpretation

## 2.1 Official identity

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Problem Statement                   **SIH26162**

  Organization                        **National Technical Research
                                      Organisation (NTRO)**

  Category / Track                    **Software**

  Theme                               **Miscellaneous**

  Title                               **AI-Based Detection and
                                      Classification of Industrial Fires
                                      and Persistent Thermal Sources
                                      Using NASA FIRMS, OSM & Satellite
                                      Data**
  -----------------------------------------------------------------------

## 2.2 Background interpreted for implementation

Industrial facilities generate thermal signatures visible from space.
These include signatures associated with:

-   oil refineries,
-   petrochemical complexes,
-   thermal power plants,
-   steel industries,
-   mining areas,
-   LNG terminals,
-   other persistent industrial heat sources.

Abnormal events such as:

-   accidental industrial fires,
-   gas leaks,
-   explosions,
-   abnormal thermal events,

may create thermal signatures that require differentiation from ordinary
persistent heat.

The fundamental limitation of raw FIRMS detections is that a thermal
anomaly is not, by itself, a complete semantic classification.

A hotspot may be associated with:

-   an industrial fire,
-   a persistent industrial source,
-   a gas flare,
-   agricultural burning,
-   mining activity,
-   a wildfire,
-   another static thermal source,
-   an uncertain/unknown source.

## 2.3 Official deliverables translated into engineering requirements

### MUST 1 --- Classification and segregation

The system must demonstrate classification and segregation of
**industrial fires** from:

-   forest fires,
-   other natural fires,
-   and, for a useful prototype, other common false-positive or
    competing thermal sources.

### MUST 2 --- GIS-based solution

The system must provide:

-   geographic storage or a geospatial data layer,
-   map-based visualization,
-   classified output overlaid on a map.

### MUST 3 --- Multi-source integration

The architecture must support integration of:

-   NASA FIRMS thermal anomaly data,
-   industrial infrastructure information,
-   land-cover information,
-   satellite imagery or an imagery-ready interface.

### MUST 4 --- Persistent-source reasoning

The solution must not treat every thermal detection as a new fire.
Historical recurrence and persistence must be used to distinguish
persistent sources from transient abnormal events where possible.

------------------------------------------------------------------------

# 3. Canonical Prototype Scope

## 3.1 Geographic scope

### Prototype Decision: India only

All prototype training, enrichment, visualization and demo selection
should be designed around **India**.

This means:

-   India FIRMS data is the primary thermal dataset.
-   Industrial context is collected for India.
-   Land-cover data must cover India.
-   Prototype locations are in India.
-   The dashboard defaults to an India map extent.
-   No global-scale ingestion is required for the MVP.

The architecture should remain geographically extensible, but the code
must not depend on global processing for the prototype.

## 3.2 Current thermal dataset baseline

The current dataset already inspected for the prototype is:

``` text
viirs-jpss1_2024_India.csv
```

Observed baseline:

-   approximately **578,062 rows**,
-   **15 columns**,
-   India coverage,
-   2024 observations,
-   VIIRS / NOAA-20 (JPSS-1) source,
-   no missing values observed during the initial inspection.

Expected raw columns:

``` text
latitude
longitude
bright_ti4
scan
track
acq_date
acq_time
satellite
confidence
version
bright_ti5
frp
daynight
type
instrument
```

### Important implementation note

The exact row count and values should be revalidated by code during
ingestion. Do not hard-code the row count.

## 3.3 Prototype classification taxonomy

The official problem statement requires separation of industrial and
natural thermal activity, but the prototype demo plan requires six
displayed categories.

### Canonical prototype classes

  ----------------------------------------------------------------------------------------
                            ID Class                               Meaning
  ---------------------------- ----------------------------------- -----------------------
                             0 `normal_persistent_industrial`      Known or strongly
                                                                   inferred persistent
                                                                   industrial thermal
                                                                   source operating near
                                                                   its historical baseline

                             1 `industrial_spike_anomaly`          Industrial-associated
                                                                   hotspot showing
                                                                   significant abnormal
                                                                   deviation from its
                                                                   historical thermal
                                                                   baseline

                             2 `non_industrial_thermal_activity`   Thermal activity not
                                                                   confidently
                                                                   attributable to
                                                                   industrial persistence,
                                                                   forest/vegetation fire,
                                                                   or agricultural burning

                             3 `forest_vegetation_fire`            Thermal event
                                                                   consistent with
                                                                   vegetation/forest
                                                                   context and transient
                                                                   fire behavior

                             4 `agricultural_burning`              Thermal event
                                                                   consistent with
                                                                   cropland/agricultural
                                                                   context and
                                                                   seasonal/transient
                                                                   burning behavior

                             5 `unknown_ambiguous`                 Insufficient or
                                                                   conflicting evidence
                                                                   for a confident
                                                                   semantic class
  ----------------------------------------------------------------------------------------

### Why six classes?

The 20-point prototype explicitly separates:

-   non-industrial thermal activity,
-   ambiguous/unknown activity.

These should therefore remain separate in the prototype output.

### Important caveat

The NASA FIRMS `type` field is **not the same thing as the six-class
target label**. It must not simply be renamed and used as ground truth.

------------------------------------------------------------------------

# 4. Canonical 20-Point Prototype Demonstration

The final demo must be built around the following composition.

  -----------------------------------------------------------------------------
  Prototype Type                              Points Purpose
  --------------------- ---------------------------- --------------------------
  Normal persistent                                4 Show that normal recurring
  industrial                                         industrial heat is not
                                                     falsely flagged as an
                                                     emergency

  Industrial                                       4 Demonstrate the core
  spikes/anomalies                                   abnormal-event detection
                                                     capability

  Non-industrial                                   4 Demonstrate segregation
  thermal activity                                   from industrial activity

  Forest/vegetation                                3 Demonstrate natural-fire
  fires                                              distinction

  Agricultural burning                             3 Demonstrate a major
                                                     false-positive/competing
                                                     source

  Ambiguous/unknown                                2 Demonstrate calibrated
                                                     uncertainty rather than
                                                     forced overconfidence

  **Total**                                   **20** **Final prototype
                                                     demonstration set**
  -----------------------------------------------------------------------------

## 4.1 Non-negotiable interpretation

**The 20 points are not the training set.**

The correct architecture is:

``` text
Historical India data + spatial context
                |
                v
Large / curated labelled training dataset
                |
                v
Train and validate model
                |
                v
Freeze model version
                |
                v
Run curated 20-point prototype evaluation/demo
```

Training the model only on the 20 demo points would create a weak,
overfit demonstration and should not be used.

## 4.2 What every prototype point should show

Each point should have:

``` text
prototype_id
latitude
longitude
timestamp
expected_demo_category
predicted_category
confidence
class_probabilities
anomaly_score
priority_level
nearest_industrial_context
land_cover_context
persistence_summary
current_frp
historical_frp_baseline
frp_z_score
top_explanation_factors
shap_values or SHAP summary
data_sources_used
```

The dashboard popup must make the reasoning understandable without
requiring the viewer to inspect raw model features.

------------------------------------------------------------------------

# 5. System Architecture

## 5.1 Logical layers

``` text
+----------------------------------------------------------+
|                    DATA SOURCES                          |
| NASA FIRMS | OSM | Land Cover | Satellite Imagery       |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|              INGESTION / ETL / NORMALIZATION             |
| Parse | Validate | Deduplicate | CRS handling            |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|                 GEOSPATIAL CONTEXT LAYER                 |
| Nearest facility | Point-in-polygon | Land cover         |
| Spatial index | H3/geocell grouping                      |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|              TEMPORAL / PERSISTENCE ENGINE               |
| Historical recurrence | Rolling FRP baseline             |
| Z-score | Active days | Time since prior detection       |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|                  FEATURE ENGINEERING                     |
| Thermal + Spatial + Temporal + Context + Persistence     |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|                     ML ENGINE                            |
| XGBoost multi-class classification                       |
+---------------------+--------------------+---------------+
                      |                    |
                      v                    v
+---------------------------+  +---------------------------+
| SHAP EXPLAINABILITY       |  | ANOMALY / PRIORITY SCORE  |
+-------------+-------------+  +-------------+-------------+
              \______________________________/
                             |
                             v
+----------------------------------------------------------+
|                FASTAPI / POSTGIS SERVICE                 |
+----------------------------+-----------------------------+
                             |
                             v
+----------------------------------------------------------+
|                 INDIA GIS DASHBOARD                      |
| Map | Filters | Details | Explanations | Analytics       |
+----------------------------------------------------------+
```

## 5.2 Prototype implementation simplification

For the MVP:

-   PostgreSQL + PostGIS is recommended.
-   TimescaleDB is optional.
-   Redis/Celery is optional unless scheduled ingestion is implemented.
-   Sentinel imagery enrichment can be optional or used for selected
    prototype points.
-   The ML model must work without requiring a GPU.
-   Batch inference is acceptable for the demo.
-   Real-time streaming is not required for the first working prototype.

------------------------------------------------------------------------

# 6. Data Sources and Responsibilities

## 6.1 NASA FIRMS

### Purpose

Provides thermal anomaly observations.

### Core raw information used

-   latitude,
-   longitude,
-   thermal brightness measurements,
-   FRP,
-   confidence,
-   acquisition date,
-   acquisition time,
-   day/night,
-   scan/track information,
-   FIRMS detection type.

### Prototype role

FIRMS is the primary source of thermal detections. It is **not
sufficient by itself** to solve the problem because the raw detection
lacks enough context to reliably identify the source category.

## 6.2 OpenStreetMap / industrial infrastructure

### Purpose

Provides industrial and land-use context such as:

-   industrial areas,
-   refineries,
-   power plants,
-   steel facilities,
-   mines,
-   LNG-related infrastructure where available,
-   other industrial facilities.

### Prototype features

At minimum compute:

``` text
distance_to_nearest_industry_m
inside_industrial_area
industrial_facility_count_2km
industrial_facility_count_5km
nearest_facility_type
nearest_facility_name
```

If a specific facility polygon is available:

``` text
inside_facility_polygon
distance_to_facility_boundary_m
```

## 6.3 Land-cover data

### Purpose

Provides environmental context.

The model needs to know whether a hotspot lies in or near:

-   tree/forest/vegetation cover,
-   cropland,
-   built-up/urban area,
-   bare land,
-   water,
-   other relevant categories.

Recommended normalized output:

``` text
land_cover_class
is_tree_cover
is_cropland
is_built_up
is_water
is_bare_land
```

The exact provider can be swapped, but the schema presented to the ML
pipeline must remain stable.

## 6.4 Satellite imagery

### Role in prototype

Satellite imagery is an optional contextual layer and/or selected-point
verification mechanism.

Do not make the MVP depend on downloading and running computer vision
inference for every one of 578k+ rows unless the team has already
implemented it.

Recommended prototype use:

1.  use imagery to inspect and manually verify curated prototype points;
2.  optionally extract selected features such as NDVI;
3.  expose an imagery overlay in the GIS dashboard;
4.  keep the model interface extensible for future imagery-derived
    features.

------------------------------------------------------------------------

# 7. Raw FIRMS Data Dictionary and ML Relevance

## 7.1 `latitude`

**Keep.**

Uses:

-   map position,
-   spatial joins,
-   H3/geocell assignment,
-   nearest-facility calculations,
-   clustering.

Raw latitude/longitude may be included in experiments, but derived
spatial context is generally more meaningful.

## 7.2 `longitude`

Same role as latitude.

## 7.3 `bright_ti4`

**Core thermal feature.**

Represents a VIIRS thermal brightness measurement and should be
retained.

## 7.4 `bright_ti5`

**Core thermal feature.**

Should be retained and used together with `bright_ti4`.

## 7.5 `frp`

**Core feature.**

Fire Radiative Power is a primary measure of anomaly intensity.

Recommended derived feature:

``` python
log_frp = log1p(frp)
```

## 7.6 `confidence`

Useful detection-quality/context feature.

Recommended canonical encoding:

``` text
l -> 0
n -> 1
h -> 2
```

Keep the raw value for traceability.

## 7.7 `acq_date`

Must be parsed as a date.

Do not feed the raw date string directly to the model.

## 7.8 `acq_time`

Must be treated as a four-character time representation when leading
zeros are relevant.

Example:

``` text
0730 = 07:30 UTC
```

Never manually delete leading zeros from identifier-like or time-like
values.

Derived fields:

``` text
hour
minute
hour_sin
hour_cos
```

## 7.9 `daynight`

Encode, for example:

``` text
D -> 0
N -> 1
```

or retain as a categorical feature before model encoding.

## 7.10 `scan` and `track`

Secondary detection geometry features.

Keep for initial experiments; feature importance and validation can
later determine whether they should remain.

## 7.11 `satellite`, `instrument`, `version`

For the current single-source dataset, these may be constant.

If a column has zero variance in the training data, it should not be
used as a predictive feature.

Do not drop the raw metadata from archival storage; only exclude it from
the feature matrix if constant.

## 7.12 `type`

Do **not** treat this as the final target.

FIRMS `type` is a source-provided detection category, not the
prototype's semantic six-class taxonomy.

It may be used as:

-   a weak signal,
-   candidate-generation information,
-   data quality analysis,
-   one component of label construction.

It must not cause target leakage.

------------------------------------------------------------------------

# 8. Data Ingestion and Normalization

## 8.1 Canonical raw record schema

``` python
RawHotspot = {
    "source": str,
    "source_id": str | None,
    "latitude": float,
    "longitude": float,
    "acq_date": date,
    "acq_time": str,
    "timestamp_utc": datetime,
    "bright_ti4": float | None,
    "bright_ti5": float | None,
    "frp": float | None,
    "confidence": str | None,
    "daynight": str | None,
    "scan": float | None,
    "track": float | None,
    "firms_type": int | None,
    "satellite": str | None,
    "instrument": str | None,
    "version": str | None,
}
```

## 8.2 Validation rules

The ingestion pipeline must:

1.  verify required columns;
2.  validate latitude range `[-90, 90]`;
3.  validate longitude range `[-180, 180]`;
4.  parse dates explicitly;
5.  zero-pad acquisition times when needed;
6.  create a UTC timestamp;
7.  reject impossible negative values where the source definition
    forbids them;
8.  log malformed rows instead of silently discarding them;
9.  preserve raw data separately from processed data.

## 8.3 Deduplication

A prototype-safe deduplication strategy should avoid deleting legitimate
repeated observations.

Suggested event-level grouping conditions may include:

-   same or near location,
-   close acquisition time,
-   same satellite/product context.

The detailed threshold must be configurable.

Example configuration:

``` yaml
deduplication:
  spatial_radius_m: 1000
  temporal_window_minutes: 30
```

Do not hard-code these values throughout the codebase.

------------------------------------------------------------------------

# 9. Feature Engineering

Feature engineering is the core of the solution.

The model should not be framed as:

``` text
FIRMS row -> XGBoost -> label
```

The intended pipeline is:

``` text
FIRMS row
   +
historical behavior
   +
industrial proximity
   +
land-cover context
   +
temporal pattern
        |
        v
context-aware feature vector
        |
        v
XGBoost
```

## 9.1 Thermal features

Required initial features:

``` text
bright_ti4
bright_ti5
frp
log_frp
thermal_difference = bright_ti4 - bright_ti5
```

Optional experiments:

``` text
thermal_ratio
frp_per_detection_area
temperature_anomaly_relative_to_local_baseline
```

All optional features must be documented in the model metadata if
enabled.

## 9.2 Temporal features

Required derived features:

``` text
month
day_of_year
day_of_week
hour
minute
is_night
hour_sin
hour_cos
```

Cyclical encoding:

``` python
hour_sin = sin(2 * pi * hour / 24)
hour_cos = cos(2 * pi * hour / 24)
```

## 9.3 Persistence features

This is one of the most important components for distinguishing
persistent industrial heat from transient events.

Use H3 cells or another deterministic spatial-cell strategy.

For each hotspot, compute historical features using only observations
**before the current event timestamp**.

This rule is critical to prevent temporal leakage.

Suggested windows:

``` text
7 days
30 days
90 days
```

Core features:

``` text
observation_count_7d
observation_count_30d
observation_count_90d

active_days_7d
active_days_30d
active_days_90d

days_since_first_seen
days_since_previous_detection

mean_frp_7d
mean_frp_30d
mean_frp_90d

median_frp_30d
std_frp_30d
max_frp_30d
```

If no historical baseline exists, use explicit missing indicators:

``` text
has_history_7d
has_history_30d
has_history_90d
```

Do not silently replace "no history" with a normal baseline.

## 9.4 FRP anomaly features

Core formulas:

``` text
frp_deviation = current_frp - historical_mean_frp
```

``` text
frp_ratio_to_baseline =
current_frp / max(historical_mean_frp, epsilon)
```

``` text
frp_z_score =
(current_frp - historical_mean_frp) /
max(historical_std_frp, epsilon)
```

Use a small configurable `epsilon` to avoid division by zero.

These features are especially important for `industrial_spike_anomaly`.

Example interpretation:

``` text
Current FRP = 420
Historical mean = 110
Historical std = 60

z-score = (420 - 110) / 60 = 5.17
```

A large positive z-score is evidence of abnormal escalation, but it is
not by itself proof of an industrial fire.

## 9.5 Industrial proximity features

Required candidates:

``` text
distance_to_nearest_industry_m
distance_to_nearest_refinery_m
distance_to_nearest_power_plant_m
distance_to_nearest_mine_m

inside_industrial_area
inside_facility_polygon

industrial_facility_count_2km
industrial_facility_count_5km
```

Facility type should be normalized into stable categories.

Example:

``` text
refinery
power_plant
steel
petrochemical
mine
lng_terminal
industrial_other
unknown
```

## 9.6 Land-cover features

At minimum:

``` text
land_cover_class
is_tree_cover
is_cropland
is_built_up
is_water
is_bare_land
```

Land-cover data should be reprojected and joined consistently.

## 9.7 Spatial clustering features

Optional but valuable:

``` text
neighbor_hotspot_count_1km_24h
neighbor_hotspot_count_5km_24h
cluster_size
cluster_growth_rate
```

These can help distinguish a broad transient fire cluster from a single
persistent industrial source.

------------------------------------------------------------------------

# 10. Label Construction Strategy

## 10.1 Core problem

The raw FIRMS dataset does not provide ground-truth labels matching the
six prototype classes.

Therefore, a supervised model requires a deliberate label-construction
process.

## 10.2 Canonical approach: hybrid weak supervision + human verification

``` text
Raw FIRMS observations
        |
        v
Rule-based candidate generation
        |
        v
Spatial / temporal evidence enrichment
        |
        v
Candidate class assignments
        |
        v
Manual verification of representative samples
        |
        v
Curated labelled training dataset
        |
        v
XGBoost training
```

## 10.3 Candidate rules --- normal persistent industrial

Candidate evidence:

``` text
close to industrial facility
AND repeated historical detections
AND relatively stable FRP
AND low anomaly deviation
```

Illustrative rule:

``` text
distance_to_industry < configured_threshold
AND active_days_90d >= configured_threshold
AND abs(frp_z_score) < configured_threshold
```

This is a candidate-generation rule, not the final classifier.

## 10.4 Candidate rules --- industrial spike/anomaly

Candidate evidence:

``` text
industrial association
AND historical persistence exists
AND current thermal intensity / FRP is significantly above baseline
```

Illustrative:

``` text
distance_to_industry < configured_threshold
AND has_history_30d = true
AND frp_z_score > configured_threshold
```

## 10.5 Candidate rules --- forest/vegetation fire

Candidate evidence:

``` text
tree/vegetation land cover
AND low industrial proximity
AND transient behavior
AND optional local cluster evidence
```

## 10.6 Candidate rules --- agricultural burning

Candidate evidence:

``` text
cropland context
AND low industrial association
AND seasonal/transient behavior
```

Seasonality should be treated as supporting evidence, not an absolute
rule.

## 10.7 Candidate rules --- non-industrial thermal activity

Candidate when:

``` text
not strongly industrial
AND not strongly forest/vegetation
AND not strongly cropland
AND evidence supports a real thermal source
```

This class must not become an uncontrolled catch-all. Its examples
should be curated.

## 10.8 Candidate rules --- unknown/ambiguous

Use when:

-   spatial evidence conflicts,
-   historical evidence is insufficient,
-   no class has adequate support,
-   model confidence is low,
-   or the data is outside the validated feature distribution.

The system must be allowed to say **"unknown"**.

## 10.9 Manual verification requirement

The training set should include manually checked examples.

For each labelled example store:

``` text
label
label_source
label_confidence
verification_notes
verified_by
verification_timestamp
```

Suggested label source values:

``` text
manual
weak_rule
external_reference
hybrid
```

### Quality principle

A smaller set of well-verified examples is preferable to a large set of
blindly generated pseudo-labels.

------------------------------------------------------------------------

# 11. ML Training Blueprint

## 11.1 Model

Primary:

``` text
XGBoost Classifier
```

Objective:

``` text
multi-class probability classification
```

Conceptual configuration:

``` python
XGBClassifier(
    objective="multi:softprob",
    num_class=6,
    eval_metric="mlogloss",
    random_state=42,
)
```

The final hyperparameters must be stored in a versioned configuration
file.

## 11.2 Feature groups

### Group A --- thermal

``` text
bright_ti4
bright_ti5
thermal_difference
frp
log_frp
```

### Group B --- detection metadata

``` text
confidence_encoded
is_night
scan
track
```

### Group C --- temporal

``` text
month
day_of_year
hour
hour_sin
hour_cos
```

### Group D --- persistence

``` text
observation_count_30d
active_days_30d
mean_frp_30d
std_frp_30d
frp_z_score
frp_ratio_to_baseline
days_since_previous_detection
```

### Group E --- industrial context

``` text
distance_to_nearest_industry_m
inside_industrial_area
industrial_facility_count_2km
industrial_facility_count_5km
nearest_facility_type_encoded
```

### Group F --- environmental context

``` text
land_cover_class_encoded
is_tree_cover
is_cropland
is_built_up
```

The exact first model can use fewer features, but the feature schema
must be versioned.

## 11.3 Class imbalance

Class imbalance is expected.

Possible methods:

-   balanced sample construction,
-   per-class sample weights,
-   targeted data collection,
-   conservative use of oversampling.

Do not optimize only for overall accuracy.

## 11.4 Data split strategy

Avoid a naive random split when repeated observations from the same
location can appear in both train and test sets.

Preferred first split:

``` text
Train: earlier period
Validation: later period
Test: latest held-out period
```

Example conceptual split:

``` text
January–September -> train
October–November -> validation
December -> test
```

A stronger future split may also group by spatial cell or facility.

### Leakage prevention

For a prediction at time `T`:

-   rolling baselines may only use records before `T`;
-   future observations must not influence persistence features;
-   labels or rules used to create labels must not appear as direct
    predictive inputs.

## 11.5 Evaluation metrics

Required:

``` text
accuracy
macro_precision
macro_recall
macro_f1
per_class_precision
per_class_recall
confusion_matrix
```

Macro F1 is particularly important because a model can obtain
deceptively high accuracy by favoring majority classes.

## 11.6 Calibration

The system should expose probabilities.

Potential output:

``` json
{
  "normal_persistent_industrial": 0.07,
  "industrial_spike_anomaly": 0.84,
  "non_industrial_thermal_activity": 0.03,
  "forest_vegetation_fire": 0.02,
  "agricultural_burning": 0.01,
  "unknown_ambiguous": 0.03
}
```

The maximum probability is not automatically equal to calibrated
certainty. Probability calibration should be evaluated if enough
labelled validation data is available.

------------------------------------------------------------------------

# 12. Unknown and Uncertainty Handling

The prototype must not force every event into a confident known class.

## 12.1 Decision strategy

A simple prototype strategy may combine:

``` text
maximum model probability
+
prediction margin
+
rule conflicts
+
data quality checks
```

Example:

``` text
If max_probability < 0.50:
    classify as unknown_ambiguous

Else if top_two_probability_margin < 0.10:
    classify as unknown_ambiguous or mark low confidence

Else:
    use predicted class
```

Thresholds must be configurable and tuned using validation data.

## 12.2 Out-of-distribution warning

If important features are outside the training distribution, return an
additional warning:

``` text
ood_warning = true
```

This is optional for the MVP but desirable for honest model behavior.

------------------------------------------------------------------------

# 13. SHAP Explainability

## 13.1 Required purpose

SHAP is used to answer:

> Why did the model classify this hotspot this way?

## 13.2 Required outputs

For each prediction:

-   predicted class,
-   confidence,
-   top positive contributors,
-   top negative contributors,
-   human-readable explanation factors.

Example:

``` text
Prediction: Industrial Spike / Anomaly
Confidence: 92%

Main reasons:
+ Hotspot is 180 m from an industrial facility
+ FRP is 3.8× above the 30-day baseline
+ FRP z-score is high
+ Persistent detections exist at this location
- Tree-cover context reduces wildfire likelihood
```

## 13.3 Global explainability

The system should also support:

-   global feature importance,
-   per-class feature importance where practical,
-   SHAP summary visualizations for model analysis.

## 13.4 Dashboard rule

Do not expose only raw SHAP values.

The UI should convert the main contributions into understandable text.

------------------------------------------------------------------------

# 14. Anomaly / Priority Score

The ML class and anomaly score are related but not identical.

A normal persistent industrial source may have:

``` text
high persistence
high industrial proximity
low abnormality
```

An industrial anomaly may have:

``` text
high industrial proximity
high persistence
high FRP deviation
high escalation
```

## 14.1 Proposed score inputs

``` text
FRP deviation
persistence anomaly
industrial proximity
spatial spread
temporal anomaly
classification confidence
```

Conceptual formula:

``` text
APS =
w1 * normalized_frp_deviation
+ w2 * persistence_anomaly
+ w3 * industrial_proximity
+ w4 * spatial_spread
+ w5 * temporal_anomaly
+ w6 * confidence
```

Normalize to:

``` text
0–100
```

Priority:

     Score Level
  -------- --------
     \> 75 High
    50--75 Medium
     \< 50 Low

### Prototype requirement

Weights must be stored in configuration, not embedded as unexplained
constants.

------------------------------------------------------------------------

# 15. Database and Geospatial Storage

## 15.1 Recommended database

``` text
PostgreSQL + PostGIS
```

TimescaleDB is optional.

## 15.2 Core tables

### `hotspots`

``` text
id
source
source_record_id
geom
latitude
longitude
timestamp_utc
bright_ti4
bright_ti5
frp
confidence
daynight
scan
track
firms_type
raw_payload
created_at
```

### `industrial_facilities`

``` text
id
name
facility_type
source
source_id
geom
tags
updated_at
```

### `land_cover_cache` or raster-backed lookup

Implementation-dependent, but the ML enrichment layer must expose
normalized land-cover values.

### `hotspot_features`

``` text
hotspot_id
feature_version
thermal_difference
log_frp
persistence_features...
industrial_features...
land_cover_features...
created_at
```

### `classifications`

``` text
id
hotspot_id
model_version
predicted_class
confidence
class_probabilities
anomaly_score
priority_level
unknown_reason
created_at
```

### `explanations`

``` text
id
classification_id
method
top_features
shap_values
human_readable_summary
created_at
```

### `prototype_points`

``` text
prototype_id
hotspot_id
expected_demo_class
selection_rationale
verification_status
notes
```

## 15.3 Required spatial operations

The database or processing layer should support:

-   point-in-polygon,
-   nearest-neighbor lookup,
-   distance calculations,
-   spatial indexes,
-   GeoJSON output.

Example PostGIS concepts:

``` text
ST_Contains
ST_DWithin
ST_Distance
ST_AsGeoJSON
```

------------------------------------------------------------------------

# 16. Backend Architecture

## 16.1 Recommended framework

``` text
FastAPI
```

## 16.2 Suggested repository structure

``` text
pyroclass/
├── README.md
├── docs/
│   └── SIH26162_CANONICAL_BASELINE.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── hotspots.py
│   │   │       ├── classifications.py
│   │   │       ├── analytics.py
│   │   │       └── prototype.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── ingestion_service.py
│   │   │   ├── feature_service.py
│   │   │   ├── persistence_service.py
│   │   │   ├── classification_service.py
│   │   │   ├── anomaly_service.py
│   │   │   └── explainability_service.py
│   │   └── utils/
│   └── requirements.txt
├── ml/
│   ├── data/
│   │   ├── raw/
│   │   ├── external/
│   │   ├── processed/
│   │   └── labelled/
│   ├── notebooks/
│   │   ├── 01_eda.ipynb
│   │   ├── 02_cleaning.ipynb
│   │   ├── 03_spatial_features.ipynb
│   │   ├── 04_temporal_features.ipynb
│   │   ├── 05_labelling.ipynb
│   │   ├── 06_train_xgboost.ipynb
│   │   └── 07_shap_analysis.ipynb
│   ├── src/
│   │   ├── ingest.py
│   │   ├── features.py
│   │   ├── labels.py
│   │   ├── train.py
│   │   ├── evaluate.py
│   │   └── predict.py
│   ├── models/
│   └── configs/
├── frontend/
│   └── ...
├── data/
│   └── prototype_20.csv
└── docker-compose.yml
```

------------------------------------------------------------------------

# 17. API Contract

## 17.1 Get hotspots

``` http
GET /api/v1/hotspots
```

Filters:

``` text
bbox
start_time
end_time
classification
min_frp
min_anomaly_score
```

Recommended response format:

``` text
GeoJSON FeatureCollection
```

## 17.2 Get hotspot detail

``` http
GET /api/v1/hotspots/{id}
```

Must include:

-   raw summary,
-   enriched features,
-   classification,
-   confidence,
-   anomaly score,
-   explanation.

## 17.3 Classify hotspot

``` http
POST /api/v1/hotspots/{id}/classify
```

Returns:

``` json
{
  "hotspot_id": "uuid",
  "model_version": "xgb-v1",
  "predicted_class": "industrial_spike_anomaly",
  "confidence": 0.92,
  "probabilities": {},
  "anomaly_score": 87,
  "priority_level": "high",
  "explanation": {
    "top_factors": []
  }
}
```

## 17.4 Prototype points

``` http
GET /api/v1/prototype/points
```

Returns the curated 20-point set.

``` http
GET /api/v1/prototype/points/{prototype_id}
```

Returns the full demo evidence package.

## 17.5 Dashboard analytics

``` http
GET /api/v1/analytics/dashboard
```

Potential outputs:

-   total hotspots,
-   category counts,
-   anomaly counts,
-   FRP trend,
-   top industrial facility types.

------------------------------------------------------------------------

# 18. Frontend / GIS Dashboard

## 18.1 Core technologies

Recommended:

``` text
React
MapLibre GL JS
Deck.gl
Tailwind CSS
TanStack Query
```

A simpler mapping stack is acceptable if the required GIS behavior is
preserved.

## 18.2 Required map behavior

The map should display:

-   India-focused initial extent,
-   classified hotspots,
-   category color coding,
-   industrial facilities when enabled,
-   filters,
-   click-to-open hotspot details.

## 18.3 Required detail panel

For a selected hotspot:

``` text
Classification
Confidence
Anomaly / Priority Score
Current FRP
Historical baseline
FRP deviation / z-score
Nearest industrial context
Land-cover context
Persistence summary
Top explanation factors
```

## 18.4 Prototype demo mode

Add a dedicated mode or filter that displays only the curated 20 points.

The demo mode should make it easy to step through all categories without
searching manually.

------------------------------------------------------------------------

# 19. Color and Visual Semantics

Suggested prototype mapping:

  Class                             Suggested semantic color
  --------------------------------- --------------------------
  Normal persistent industrial      Green
  Industrial spike/anomaly          Red
  Non-industrial thermal activity   Yellow / amber
  Forest/vegetation fire            Green-brown / forest
  Agricultural burning              Earth / crop tone
  Unknown/ambiguous                 Grey / purple

The exact hex colors are a frontend design decision.

The semantic meaning must remain consistent across:

-   map markers,
-   legends,
-   charts,
-   detail cards,
-   prototype demo.

------------------------------------------------------------------------

# 20. End-to-End Processing Sequence

## Step 1 --- Ingest

Load FIRMS India records.

## Step 2 --- Normalize

Parse:

-   timestamps,
-   numeric values,
-   confidence,
-   coordinates.

## Step 3 --- Spatially index

Assign H3/geocell or equivalent deterministic spatial grouping.

## Step 4 --- Enrich

Find:

-   nearest industrial facility,
-   industrial containment,
-   land-cover class,
-   optional imagery context.

## Step 5 --- Build historical features

For each event, compute:

-   previous detections,
-   active days,
-   rolling FRP statistics,
-   anomaly features.

Only historical data prior to the event timestamp may be used.

## Step 6 --- Generate feature vector

Create the model-versioned feature schema.

## Step 7 --- Classify

Run XGBoost.

## Step 8 --- Uncertainty handling

Apply confidence/margin rules.

## Step 9 --- Explain

Run SHAP and generate human-readable factors.

## Step 10 --- Score anomaly

Calculate APS/anomaly score.

## Step 11 --- Persist

Store:

-   raw record,
-   features,
-   classification,
-   explanation.

## Step 12 --- Visualize

Serve the result as map-ready API output.

------------------------------------------------------------------------

# 21. ML Engineer Responsibilities

The ML Engineer owns the classification intelligence.

Primary responsibilities:

1.  inspect and validate the FIRMS dataset;
2.  build preprocessing;
3.  define the feature schema;
4.  implement persistence features;
5.  implement thermal baseline and anomaly features;
6.  assist with label construction;
7.  train and evaluate XGBoost;
8.  handle class imbalance;
9.  prevent temporal and target leakage;
10. integrate SHAP;
11. version models and feature schemas;
12. provide a stable inference interface to the backend.

### Canonical ML role statement

> Develop the XGBoost-based, context-aware thermal hotspot
> classification engine using satellite thermal features, historical
> persistence, geospatial industrial context and land-cover features,
> with SHAP-based explanations for transparent predictions.

------------------------------------------------------------------------

# 22. Training Workflow --- Exact Order

## Phase 1 --- Dataset inspection

Deliverables:

-   data dictionary,
-   missing-value report,
-   duplicate report,
-   numeric distributions,
-   FRP distribution,
-   confidence distribution,
-   type distribution.

## Phase 2 --- Cleaning

Deliverables:

-   normalized timestamps,
-   cleaned numeric columns,
-   leading-zero-safe time handling,
-   raw-to-processed transformation.

## Phase 3 --- Baseline features

Deliverables:

``` text
thermal_difference
log_frp
month
day_of_year
hour
is_night
confidence_encoded
```

## Phase 4 --- Persistence engine

Deliverables:

-   H3/geocell assignment,
-   7/30/90 day counts,
-   rolling baseline,
-   FRP z-score.

## Phase 5 --- Spatial enrichment

Deliverables:

-   industrial distances,
-   industrial containment,
-   facility metadata,
-   land-cover features.

## Phase 6 --- Label construction

Deliverables:

-   candidate-generation rules,
-   verification workflow,
-   labelled dataset,
-   label confidence.

## Phase 7 --- Baseline model

Train a first XGBoost model.

Record:

-   feature list,
-   class distribution,
-   hyperparameters,
-   split methodology,
-   metrics.

## Phase 8 --- Error analysis

Inspect confusion between:

-   industrial anomaly vs normal industrial,
-   forest fire vs agricultural burning,
-   non-industrial vs unknown.

Do not jump directly into hyperparameter tuning before understanding
errors.

## Phase 9 --- Final prototype model

Freeze:

``` text
model_version
feature_version
label_version
data_snapshot
```

## Phase 10 --- SHAP and integration

Expose inference results through the backend.

## Phase 11 --- 20-point demo validation

Run the frozen model on all curated prototype points and record actual
results.

------------------------------------------------------------------------

# 23. Prototype Acceptance Criteria

The prototype is considered complete only when the following are
demonstrably working.

## Data

-   [ ] India FIRMS data loads reproducibly.
-   [ ] Acquisition dates/times are parsed correctly.
-   [ ] Historical features use no future observations.
-   [ ] Industrial context is joined for relevant locations.
-   [ ] Land-cover context is joined.

## ML

-   [ ] A six-class prototype taxonomy exists.
-   [ ] The training dataset contains documented labels.
-   [ ] XGBoost training is reproducible.
-   [ ] Macro metrics and confusion matrix are produced.
-   [ ] Probabilities are returned.
-   [ ] Unknown/ambiguous behavior exists.
-   [ ] SHAP explanations are generated.

## Backend

-   [ ] Hotspots can be queried.
-   [ ] A hotspot classification can be retrieved.
-   [ ] Results contain confidence and explanation.
-   [ ] Prototype 20-point records are accessible.

## Frontend

-   [ ] India map renders.
-   [ ] Classified hotspots are visible.
-   [ ] Map legend is clear.
-   [ ] Clicking a hotspot shows classification evidence.
-   [ ] The 20-point demo mode works.

## Demo

-   [ ] 4 normal persistent industrial points are available.
-   [ ] 4 industrial spike/anomaly points are available.
-   [ ] 4 non-industrial thermal points are available.
-   [ ] 3 forest/vegetation fire points are available.
-   [ ] 3 agricultural burning points are available.
-   [ ] 2 unknown/ambiguous points are available.
-   [ ] Actual model outputs are shown without fabricated accuracy
    claims.

------------------------------------------------------------------------

# 24. Explicit Non-Goals for the MVP

The first prototype does **not** require:

-   global coverage,
-   a native mobile application,
-   crowdsourcing,
-   push notifications,
-   full real-time streaming,
-   multi-satellite fusion,
-   deep-learning imagery classification,
-   production-scale distributed infrastructure,
-   operational emergency dispatch.

These can be future extensions.

The MVP must first prove:

> Context-aware classification of India thermal anomalies with
> explainable industrial-vs-natural segregation on a GIS map.

------------------------------------------------------------------------

# 25. Future Extensions

After the prototype:

-   add real-time FIRMS polling;
-   add MODIS and multiple VIIRS sources;
-   add Sentinel-2/1 automated feature extraction;
-   add crowdsourced verification;
-   add push notifications;
-   add human corroboration scoring;
-   add facility-level report cards;
-   add external alert webhooks;
-   expand from India to South Asia/global regions;
-   add active learning for ambiguous labels;
-   add model monitoring and drift detection.

------------------------------------------------------------------------

# 26. Critical Failure Modes to Avoid

## Failure 1 --- Training directly on 20 points

Do not do this.

The 20 points are a demonstration/evaluation set.

## Failure 2 --- Treating FIRMS `type` as final ground truth

Do not do this.

The prototype target taxonomy is different.

## Failure 3 --- Using only latitude/longitude and FRP

This misses the central value of the problem:

-   industrial context,
-   land cover,
-   persistence.

## Failure 4 --- Temporal leakage

Never compute a "historical" baseline using future observations.

## Failure 5 --- Claiming facility-level certainty beyond sensor resolution

A hotspot near a facility is evidence of association, not always
definitive proof of the exact emitting asset.

The UI should communicate uncertainty honestly.

## Failure 6 --- Optimizing only for accuracy

Use macro F1 and per-class metrics.

## Failure 7 --- Forcing every prediction into a known class

Keep `unknown_ambiguous`.

## Failure 8 --- Showing SHAP numbers without interpretation

Convert model explanations into understandable reasons.

## Failure 9 --- Building unnecessary infrastructure before the model works

A beautiful dashboard around an unvalidated classifier is still a
beautiful problem.

Implement the end-to-end minimal vertical slice first.

------------------------------------------------------------------------

# 27. Configuration Requirements

All important thresholds must be configurable.

Example:

``` yaml
prototype:
  region: India
  demo_point_count: 20

classes:
  - normal_persistent_industrial
  - industrial_spike_anomaly
  - non_industrial_thermal_activity
  - forest_vegetation_fire
  - agricultural_burning
  - unknown_ambiguous

persistence:
  spatial_index: h3
  windows_days: [7, 30, 90]

candidate_rules:
  industrial_distance_m: 2000
  anomaly_z_score: 3.0
  unknown_probability_threshold: 0.50
  unknown_margin_threshold: 0.10

deduplication:
  spatial_radius_m: 1000
  temporal_window_minutes: 30
```

These values are starting points and must be validated against actual
data.

------------------------------------------------------------------------

# 28. Reproducibility Requirements

Every model artifact must have metadata.

Example:

``` json
{
  "model_version": "xgb-v1",
  "feature_version": "features-v1",
  "label_version": "labels-v1",
  "training_data_version": "india-2024-v1",
  "random_seed": 42,
  "classes": [
    "normal_persistent_industrial",
    "industrial_spike_anomaly",
    "non_industrial_thermal_activity",
    "forest_vegetation_fire",
    "agricultural_burning",
    "unknown_ambiguous"
  ]
}
```

The project should also retain:

-   preprocessing configuration,
-   feature list,
-   training metrics,
-   confusion matrix,
-   model hyperparameters,
-   data provenance.

------------------------------------------------------------------------

# 29. Recommended First Implementation Sprint

## Sprint objective

Build one complete vertical slice.

### Task 1

Load the India FIRMS CSV.

### Task 2

Create:

``` text
timestamp_utc
log_frp
thermal_difference
month
hour
confidence_encoded
is_night
```

### Task 3

Assign H3/geocell IDs.

### Task 4

Compute a basic historical:

``` text
observation_count_30d
mean_frp_30d
std_frp_30d
frp_z_score
```

### Task 5

Load a small industrial facility dataset for selected India regions.

### Task 6

Compute:

``` text
distance_to_nearest_industry_m
```

### Task 7

Add one land-cover source.

### Task 8

Create a small manually verified labelled subset.

### Task 9

Train XGBoost.

### Task 10

Return:

``` text
class
confidence
top SHAP factors
```

### Task 11

Display the result on an India map.

Once this vertical slice works, expand the data and the 20-point
demonstration set.

------------------------------------------------------------------------

# 30. Canonical Definition of Done

The SIH26162 India prototype should be considered demo-ready when a
judge can observe the following sequence:

1.  Open the India GIS dashboard.
2.  See thermal hotspots overlaid on the map.
3.  Select a normal persistent industrial hotspot.
4.  See that the system recognizes historical persistence and does not
    falsely treat normal heat as an emergency.
5.  Select an industrial anomaly.
6.  See evidence of abnormal deviation from its historical thermal
    baseline.
7.  Select non-industrial, forest and agricultural examples.
8.  See how land cover and industrial context change the classification.
9.  Select an ambiguous point.
10. See the system communicate uncertainty rather than inventing
    certainty.
11. Read a concise SHAP-backed explanation for each prediction.

If this sequence works convincingly for the curated 20-point India
prototype, the MVP directly demonstrates the core intent of SIH26162.

------------------------------------------------------------------------

# 31. Final Canonical Principle

PyroClass is **not simply a fire detector**.

It is a:

> **Context-aware geospatial thermal anomaly classification system that
> combines satellite thermal observations, historical persistence,
> industrial infrastructure proximity, environmental land-cover context
> and explainable machine learning to distinguish persistent industrial
> heat, abnormal industrial events and competing natural or
> non-industrial thermal sources.**

For the prototype, the entire system is intentionally scoped to
**India** and demonstrated through a balanced **20-point curated
prototype set**.

------------------------------------------------------------------------

# 32. Implementation Priority Order

``` text
P0 — Data ingestion and validation
P0 — Feature schema and persistence engine
P0 — Industrial + land-cover enrichment
P0 — Label construction and verified training subset
P0 — XGBoost baseline
P0 — SHAP explanations
P0 — 20-point India demo set

P1 — PostGIS integration
P1 — Full dashboard analytics
P1 — Better spatial clustering
P1 — Probability calibration

P2 — Satellite-image feature extraction
P2 — Scheduled near-real-time ingestion
P2 — Crowdsourcing / verification
P2 — External alerting
P2 — Multi-region expansion
```

------------------------------------------------------------------------

# 33. Instructions for Future Coding AIs

When working from this document:

1.  Preserve the **India-only prototype scope** unless explicitly asked
    to expand it.
2.  Preserve the **six-class prototype taxonomy**.
3.  Treat the **20 points as a demo/evaluation set**, not the training
    set.
4.  Do not replace the contextual model with raw FIRMS-only
    classification.
5.  Do not use future records in historical features.
6.  Do not treat FIRMS `type` as final ground truth.
7.  Keep unknown/ambiguous handling.
8.  Keep SHAP explanations connected to actual model features.
9.  Keep thresholds configurable.
10. Version data, features, labels and models.
11. Prefer a working vertical slice over speculative infrastructure.
12. When adding a feature, document:
    -   source,
    -   calculation,
    -   timestamp availability,
    -   leakage risk,
    -   missing-value behavior.
13. Do not claim evaluation numbers that were not produced by actual
    experiments.
14. Preserve the distinction between:
    -   **official problem requirements**, and
    -   **team-specific prototype design decisions**.

This document is the canonical engineering baseline until superseded by
an explicitly versioned update.

---

# Classification Taxonomy and ML Decision Framework

## Why this taxonomy is critical

The ML component must not simply classify every FIRMS hotspot as “industrial” or “forest fire.” For the India-only prototype, it should distinguish normal industrial thermal activity, unusual industrial events, and common non-industrial sources of satellite-detected heat.

The recommended prototype taxonomy contains **six output categories**.

## 1. Normal Persistent Industrial Activity

**Label:** `normal_persistent_industrial`

Thermal hotspots associated with industrial locations that show recurring or historically expected activity.

**Expected behavior:** Recognize as industrial but **do not flag as anomalous**.

Key signals:
- Close to industrial infrastructure
- Repeated historical detections
- Current FRP/thermal values broadly consistent with local history

## 2. Industrial Spike / Anomaly

**Label:** `industrial_spike_anomaly`

An industrial or likely-industrial hotspot whose current thermal characteristics are unusually different from its historical pattern.

This is the **core anomaly category** of the prototype.

Key signals:
- Industrial proximity/context
- Historical persistence
- Significant FRP or thermal increase
- High deviation from historical baseline
- Unusual recent temporal behavior

Example:

```text
FRP anomaly / z-score =
(current FRP - historical mean FRP)
/
historical standard deviation
```

## 3. Non-Industrial Thermal Activity

**Label:** `non_industrial_thermal_activity`

A broad category for thermal events that are not confidently industrial and do not fit the forest-fire or agricultural-burning classes.

**Purpose:** Prevent forcing every non-industrial hotspot into forest or agricultural categories.

## 4. Forest / Vegetation Fire

**Label:** `forest_vegetation_fire`

Hotspots whose spatial and environmental context indicates burning in forest, woodland, grassland, or other natural vegetation.

Key signals:
- Tree/vegetation land-cover context
- Forest/vegetation overlap or proximity
- Spatial clustering consistent with fire
- Low industrial proximity

## 5. Agricultural Burning

**Label:** `agricultural_burning`

Thermal detections associated with cropland or agricultural areas where crop-residue or field burning is the likely source.

Key signals:
- Cropland context
- Seasonal/temporal patterns
- Low industrial proximity
- Spatial distribution over agricultural areas

## 6. Unknown / Ambiguous

**Label:** `unknown_ambiguous`

Use when evidence is insufficient for a reliable classification.

The system must be allowed to say:

> The available evidence is insufficient to classify this hotspot confidently.

Possible triggers:
- Low maximum class probability
- Small gap between the top two probabilities
- Missing critical context
- Event outside the expected training-data distribution

Example:

```text
if max_class_probability < CONFIDENCE_THRESHOLD:
    output = unknown_ambiguous

elif top_probability - second_probability < AMBIGUITY_MARGIN:
    output = unknown_ambiguous
```

Thresholds must be experimentally validated and stored in configuration.

## Classification Hierarchy

```text
Satellite Thermal Hotspot
        |
        +-- Industrial context?
        |       |
        |       +-- Yes
        |       |     |
        |       |     +-- Normal historical pattern?
        |       |             |
        |       |             +-- Yes -> Normal Persistent Industrial
        |       |             |
        |       |             +-- No  -> Industrial Spike / Anomaly
        |       |
        |       +-- No / weak evidence
        |               |
        |               +-- Forest / vegetation context -> Forest / Vegetation Fire
        |               |
        |               +-- Cropland context -> Agricultural Burning
        |               |
        |               +-- Other evidence -> Non-Industrial Thermal Activity
        |               |
        |               +-- Insufficient evidence -> Unknown / Ambiguous
```

This is a conceptual framework. The actual implementation may use a direct multiclass XGBoost classifier, but its features and post-processing should preserve this logic.

## Classification vs Priority

These are **not the same thing**.

```text
Classification: industrial_spike_anomaly
Confidence: 0.91
Priority score: 88/100
```

The classifier answers:

> What type of thermal event is this?

The anomaly/priority logic answers:

> How unusual or important is this event?

Keep classification, confidence, and priority/anomaly score as separate outputs.

## Recommended Prototype Output

Each classified hotspot should expose:

```text
event_id
predicted_class
confidence
class_probabilities
priority_score
model_version
feature_version
top_explanatory_features
```

Example:

```text
Predicted Class: Industrial Spike / Anomaly
Confidence: 91%

Why:
+ FRP substantially above local historical baseline
+ Strong industrial proximity
+ Persistent hotspot history

Priority: High
```

## Prototype Taxonomy Summary

| # | Display Name | Machine Label | Main Purpose |
|---|---|---|---|
| 1 | Normal Persistent Industrial | `normal_persistent_industrial` | Recognize normal industrial heat and avoid false alarms |
| 2 | Industrial Spike / Anomaly | `industrial_spike_anomaly` | Detect unusual industrial thermal events |
| 3 | Non-Industrial Thermal Activity | `non_industrial_thermal_activity` | Separate miscellaneous non-industrial heat sources |
| 4 | Forest / Vegetation Fire | `forest_vegetation_fire` | Identify natural vegetation/forest fires |
| 5 | Agricultural Burning | `agricultural_burning` | Identify crop/field burning |
| 6 | Unknown / Ambiguous | `unknown_ambiguous` | Avoid forced low-confidence classifications |

## Mandatory Implementation Rules

1. Keep these six categories consistent across training, label mapping, backend APIs, database values, and frontend display.
2. Do not collapse `normal_persistent_industrial` and `industrial_spike_anomaly` into one class; their distinction is central to the prototype.
3. Do not force low-confidence predictions into a specific category.
4. Keep `classification`, `confidence`, and `priority/anomaly score` separate.
5. Version the taxonomy and label mapping if class definitions change.
6. Future coding AIs must preserve these class names or explicitly update every dependent component consistently.
