
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


MATCH (n:Entity)
WHERE n.entity_type = 'ControlMeasure'
SET n:ControlMeasure;


MATCH (n:Entity)
WHERE n.entity_type = 'EmergencyAction'
SET n:EmergencyAction;


MATCH (n:Entity)
WHERE n.entity_type = 'Equipment'
SET n:Equipment;


MATCH (n:Entity)
WHERE n.entity_type = 'HazardFactor'
SET n:HazardFactor;


MATCH (n:Entity)
WHERE n.entity_type = 'ManagementRule'
SET n:ManagementRule;


MATCH (n:Entity)
WHERE n.entity_type = 'Material'
SET n:Material;


MATCH (n:Entity)
WHERE n.entity_type = 'MonitorVariable'
SET n:MonitorVariable;


MATCH (n:Entity)
WHERE n.entity_type = 'OperationStep'
SET n:OperationStep;


MATCH (n:Entity)
WHERE n.entity_type = 'Parameter'
SET n:Parameter;


MATCH (n:Entity)
WHERE n.entity_type = 'Personnel'
SET n:Personnel;


MATCH (n:Entity)
WHERE n.entity_type = 'Process'
SET n:Process;


MATCH (n:Entity)
WHERE n.entity_type = 'RiskDimension'
SET n:RiskDimension;


MATCH (n:Entity)
WHERE n.entity_type = 'RiskEvent'
SET n:RiskEvent;


MATCH (n:Entity)
WHERE n.entity_type = 'SafetyFacility'
SET n:SafetyFacility;


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'CONTROLLED_BY'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:CONTROLLED_BY {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'CONTROLLED_BY'),
    r.original_type = coalesce(row.`:TYPE`, 'CONTROLLED_BY'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_DANGEROUS_PROPERTY'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_DANGEROUS_PROPERTY {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_DANGEROUS_PROPERTY'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_DANGEROUS_PROPERTY'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_HAZARD'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_HAZARD {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_HAZARD'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_HAZARD'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_OPERATION_STEP'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_OPERATION_STEP {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_OPERATION_STEP'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_OPERATION_STEP'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_PARAMETER_INDEX'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_PARAMETER_INDEX {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_PARAMETER_INDEX'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_PARAMETER_INDEX'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_RISK_DIMENSION'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_RISK_DIMENSION {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_RISK_DIMENSION'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_RISK_DIMENSION'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'HAS_STATE'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:HAS_STATE {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'HAS_STATE'),
    r.original_type = coalesce(row.`:TYPE`, 'HAS_STATE'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'INCOMPATIBLE_WITH'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:INCOMPATIBLE_WITH {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'INCOMPATIBLE_WITH'),
    r.original_type = coalesce(row.`:TYPE`, 'INCOMPATIBLE_WITH'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'INVOLVES_EQUIPMENT'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:INVOLVES_EQUIPMENT {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'INVOLVES_EQUIPMENT'),
    r.original_type = coalesce(row.`:TYPE`, 'INVOLVES_EQUIPMENT'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'INVOLVES_MATERIAL'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:INVOLVES_MATERIAL {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'INVOLVES_MATERIAL'),
    r.original_type = coalesce(row.`:TYPE`, 'INVOLVES_MATERIAL'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'MAY_CAUSE'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:MAY_CAUSE {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'MAY_CAUSE'),
    r.original_type = coalesce(row.`:TYPE`, 'MAY_CAUSE'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'PERFORMS_ACTION'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:PERFORMS_ACTION {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'PERFORMS_ACTION'),
    r.original_type = coalesce(row.`:TYPE`, 'PERFORMS_ACTION'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'REQUIRES_MONITORING'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:REQUIRES_MONITORING {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'REQUIRES_MONITORING'),
    r.original_type = coalesce(row.`:TYPE`, 'REQUIRES_MONITORING'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'REQUIRES_PERMIT'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:REQUIRES_PERMIT {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'REQUIRES_PERMIT'),
    r.original_type = coalesce(row.`:TYPE`, 'REQUIRES_PERMIT'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'REQUIRES_PERSONNEL'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:REQUIRES_PERSONNEL {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'REQUIRES_PERSONNEL'),
    r.original_type = coalesce(row.`:TYPE`, 'REQUIRES_PERSONNEL'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
WITH row,
     trim(row.`:START_ID`) AS start_id,
     trim(row.`:END_ID`) AS end_id
WHERE row.`:TYPE` = 'TRIGGERS_EMERGENCY_ACTION'
  AND start_id IS NOT NULL AND start_id <> ''
  AND end_id IS NOT NULL AND end_id <> ''
MATCH (h:Entity {id: start_id})
MATCH (t:Entity {id: end_id})
MERGE (h)-[r:TRIGGERS_EMERGENCY_ACTION {fact_id: coalesce(row.fact_id, start_id + '_' + end_id)}]->(t)
SET r.relation = coalesce(row.relation, 'TRIGGERS_EMERGENCY_ACTION'),
    r.original_type = coalesce(row.`:TYPE`, 'TRIGGERS_EMERGENCY_ACTION'),
    r.scenario_id = coalesce(row.scenario_id, ''),
    r.source_doc = coalesce(row.source_doc, ''),
    r.source_section = coalesce(row.source_section, ''),
    r.confidence = CASE
        WHEN row.`confidence:float` IS NULL OR row.`confidence:float` = '' THEN null
        ELSE toFloat(row.`confidence:float`)
    END,
    r.evidence = coalesce(row.evidence, '');


MATCH (n) RETURN count(n) AS node_count;
MATCH ()-[r]->() RETURN count(r) AS relationship_count;
MATCH (n) RETURN labels(n) AS labels, count(n) AS count ORDER BY count DESC;
MATCH ()-[r]->() RETURN type(r) AS relationship_type, count(r) AS count ORDER BY count DESC;
