MATCH (n) DETACH DELETE n;

DROP CONSTRAINT entity_id_unique IF EXISTS;

CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (n:Entity)
REQUIRE n.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS row
WITH row,
     coalesce(row[':ID'], row.id, row.ID, row.entity_id) AS raw_id
WITH row, trim(raw_id) AS node_id
WHERE node_id IS NOT NULL AND node_id <> ''
MERGE (n:Entity {id: node_id})
SET n.name = coalesce(row.name, row.entity_name, node_id),
    n.type = coalesce(row.type, row.label, row[':LABEL'], 'Entity'),
    n.source_doc = coalesce(row.source_doc, ''),
    n.source_section = coalesce(row.source_section, '');

LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     coalesce(row[':START_ID'], row.start_id, row.START_ID, row.head_id, row.subject_id) AS raw_start_id,
     coalesce(row[':END_ID'], row.end_id, row.END_ID, row.tail_id, row.object_id) AS raw_end_id
WITH row, trim(raw_start_id) AS start_id, trim(raw_end_id) AS end_id
WHERE start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:KG_RELATION {fact_id: coalesce(row.fact_id, row.id, row.relation_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, row[':TYPE'], row.type, 'RELATED_TO'),
    r.original_type = coalesce(row[':TYPE'], row.type, row.relation, 'RELATED_TO'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, '');

MATCH (n) RETURN count(n) AS node_count;
MATCH ()-[r]->() RETURN count(r) AS relationship_count;