import csv
import re
from pathlib import Path

base = Path(r"F:\graph\neo4j-community-5.25.1\import")
nodes_csv = base / "nodes.csv"
rels_csv = base / "relationships.csv"
cypher_out = base / "import_demo.cypher"

def read_csv(path):
    try:
        f = open(path, "r", encoding="utf-8-sig", newline="")
        reader = csv.DictReader(f)
        rows = list(reader)
        f.close()
        return rows
    except UnicodeDecodeError:
        f = open(path, "r", encoding="gb18030", newline="")
        reader = csv.DictReader(f)
        rows = list(reader)
        f.close()
        return rows

def safe_rel_type(t):
    t = (t or "RELATED_TO").strip()
    t = re.sub(r"[^A-Za-z0-9_]", "_", t)
    if not t:
        t = "RELATED_TO"
    if re.match(r"^[0-9]", t):
        t = "R_" + t
    return t.upper()

def safe_label(t):
    t = (t or "Entity").strip()
    t = re.sub(r"[^A-Za-z0-9_]", "_", t)
    if not t:
        t = "Entity"
    if re.match(r"^[0-9]", t):
        t = "L_" + t
    return t

def cypher_quote(s):
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"

nodes = read_csv(nodes_csv)
rels = read_csv(rels_csv)

labels = sorted({safe_label(r.get(":LABEL") or r.get("label") or r.get("type") or "Entity") for r in nodes})
rel_types = sorted({safe_rel_type(r.get(":TYPE") or r.get("type") or "RELATED_TO") for r in rels})

parts = []

parts.append("""
MATCH (n) DETACH DELETE n;

DROP CONSTRAINT entity_id_unique IF EXISTS;

CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (n:Entity)
REQUIRE n.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS row
WITH row, trim(row.`id:ID`) AS node_id
WHERE node_id IS NOT NULL AND node_id <> ''
MERGE (n:Entity {id: node_id})
SET n.name = coalesce(row.name, node_id),
    n.entity_type = coalesce(row.`:LABEL`, 'Entity'),
    n.attrs = coalesce(row.attrs, '');
""")

for label in labels:
    parts.append(f"""
MATCH (n:Entity)
WHERE n.entity_type = {cypher_quote(label)}
SET n:{label};
""")

for rt in rel_types:
    parts.append(f"""
LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = {cypher_quote(rt)}
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {{id: start_id}})
MATCH (t:Entity {{id: end_id}})
MERGE (h)-[r:{rt} {{fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}}]->(t)
SET r.relation = coalesce(row.relation, {cypher_quote(rt)}),
    r.original_type = coalesce(row.`:TYPE`, {cypher_quote(rt)}),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');
""")

parts.append("""
MATCH (n) RETURN count(n) AS node_count;
MATCH ()-[r]->() RETURN count(r) AS relationship_count;
MATCH (n) RETURN labels(n) AS labels, count(n) AS count ORDER BY count DESC;
MATCH ()-[r]->() RETURN type(r) AS relationship_type, count(r) AS count ORDER BY count DESC;
""")

content = "\n".join(parts)

# UTF-8 without BOM
with open(cypher_out, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Generated:", cypher_out)
print("Node rows:", len(nodes))
print("Relationship rows:", len(rels))
print("Labels:", labels)
print("Relationship types:", rel_types)
