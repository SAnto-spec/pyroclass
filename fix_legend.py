import sys
import glob

file_path = r'c:\Github\pyroclass\frontend\src\components\map\MapContainer.tsx'
with open(file_path, 'r', encoding='mbcs') as f:
    content = f.read()

# Thermal Anomalies
content = content.replace(
    'className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Thermal Anomalies',
    'className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] border border-white shadow-sm" /> Thermal Anomalies'
)

# Industrial Facilities
content = content.replace(
    'className="h-2 w-2 rounded-full border border-[var(--accent)] bg-white" /> Industrial Facilities',
    'className="h-2.5 w-2.5 rounded-full bg-slate-700 border border-amber-600 shadow-sm" /> Industrial Facilities'
)

# Persistent Industrial Heat
content = content.replace(
    'className="h-2 w-2 rounded-full border border-sky-300 bg-[var(--accent)]/20" /> Persistent Industrial Heat',
    'className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/50 border border-white shadow-sm" /> Persistent Industrial Heat'
)

# Ground Observations
content = content.replace(
    'className="h-2.5 w-2.5 rounded-full bg-[#0f766e] border border-white shadow-sm" /> Ground Observations',
    'className="h-2.5 w-2.5 rounded-full bg-[#0f5e59] border border-white shadow-sm" /> Ground Observations'
)

# Fix middle dot character that got corrupted (mbcs byte 169)
content = content.replace('', '·')
content = content.replace('©', '·')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')

