// HAZOP_DA_H_R_V1 verification queries.
// Safe to run repeatedly. Read-only validation only.

MATCH (n:KGNode)
WHERE n.dataset_id = 'HAZOP_DA_H_R_V1'
RETURN count(*) AS total,
       sum(CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END) AS with_id,
       sum(CASE WHEN n.entity_id IS NOT NULL THEN 1 ELSE 0 END) AS with_entity_id,
       sum(CASE WHEN n.id IS NULL AND n.entity_id IS NOT NULL THEN 1 ELSE 0 END) AS incompatible_nodes;

MATCH (hz:KGNode)-[a:ALIGNED_TO]->(canonical:KGNode)
WHERE hz.dataset_id = 'HAZOP_DA_H_R_V1'
RETURN count(DISTINCT hz) AS aligned_reference_nodes,
       count(a) AS alignment_relations,
       count(DISTINCT canonical) AS canonical_nodes;

MATCH (:Process)-[r:NEXT_PROCESS]->(:Process)
WHERE r.dataset_id = 'HAZOP_DA_H_R_V1'
RETURN count(r) AS next_process_count;

MATCH (line:ProductionLine)-[:HAS_PROCESS]->(process:Process)
WHERE line.dataset_id = 'HAZOP_DA_H_R_V1'
RETURN line.line_code AS line_code,
       line.name AS production_line,
       coalesce(line.line_order, 999) AS line_order,
       count(DISTINCT process) AS process_count,
       collect(DISTINCT process.node_code) AS node_codes
ORDER BY line_order, line_code;

MATCH ()-[r]->()
WHERE r.dataset_id = 'HAZOP_DA_H_R_V1'
RETURN count(r) AS total_relations,
       sum(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) AS relations_with_id,
       sum(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END) AS relations_without_id;
