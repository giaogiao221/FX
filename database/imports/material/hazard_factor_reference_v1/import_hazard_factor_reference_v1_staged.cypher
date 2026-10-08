// Hazard factor reference V2.2 idempotent additive import.
CREATE CONSTRAINT kg_node_id IF NOT EXISTS FOR (n:KGNode) REQUIRE n.id IS UNIQUE;
CREATE INDEX kg_entity_type IF NOT EXISTS FOR (n:KGNode) ON (n.entity_type);

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/01_entities.csv' AS row
WITH row WHERE row.entity_type = 'Dataset' AND row.review_status = 'accepted'
MERGE (n:KGNode:Dataset {id: row.entity_id})
ON CREATE SET n.entity_id = row.entity_id, n.entity_type = row.entity_type, n.name = row.name,
              n.raw_name = row.raw_name, n.description = row.description, n.attributes_json = row.attributes_json,
              n.source_doc = row.source_doc, n.dataset_id = row.dataset_id, n.ontology_version = row.ontology_version,
              n.confidence = toFloat(row.confidence), n.review_status = row.review_status
SET n.entity_id = coalesce(n.entity_id, row.entity_id),
    n.entity_type = coalesce(n.entity_type, row.entity_type),
    n.name = CASE WHEN n.name IS NULL OR n.name = '' THEN row.name ELSE n.name END,
    n.hazard_reference_attributes_json = row.attributes_json,
    n.hazard_reference_dataset_id = row.dataset_id;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/01_entities.csv' AS row
WITH row WHERE row.entity_type = 'Document' AND row.review_status = 'accepted'
MERGE (n:KGNode:Document {id: row.entity_id})
ON CREATE SET n.entity_id = row.entity_id, n.entity_type = row.entity_type, n.name = row.name,
              n.raw_name = row.raw_name, n.description = row.description, n.attributes_json = row.attributes_json,
              n.source_doc = row.source_doc, n.dataset_id = row.dataset_id, n.ontology_version = row.ontology_version,
              n.confidence = toFloat(row.confidence), n.review_status = row.review_status
SET n.entity_id = coalesce(n.entity_id, row.entity_id),
    n.entity_type = coalesce(n.entity_type, row.entity_type),
    n.name = CASE WHEN n.name IS NULL OR n.name = '' THEN row.name ELSE n.name END,
    n.hazard_reference_attributes_json = row.attributes_json,
    n.hazard_reference_dataset_id = row.dataset_id;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/01_entities.csv' AS row
WITH row WHERE row.entity_type = 'Evidence' AND row.review_status = 'accepted'
MERGE (n:KGNode:Evidence {id: row.entity_id})
ON CREATE SET n.entity_id = row.entity_id, n.entity_type = row.entity_type, n.name = row.name,
              n.raw_name = row.raw_name, n.description = row.description, n.attributes_json = row.attributes_json,
              n.source_doc = row.source_doc, n.dataset_id = row.dataset_id, n.ontology_version = row.ontology_version,
              n.confidence = toFloat(row.confidence), n.review_status = row.review_status
SET n.entity_id = coalesce(n.entity_id, row.entity_id),
    n.entity_type = coalesce(n.entity_type, row.entity_type),
    n.name = CASE WHEN n.name IS NULL OR n.name = '' THEN row.name ELSE n.name END,
    n.hazard_reference_attributes_json = row.attributes_json,
    n.hazard_reference_dataset_id = row.dataset_id;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/01_entities.csv' AS row
WITH row WHERE row.entity_type = 'HazardFactor' AND row.review_status = 'accepted'
MERGE (n:KGNode:HazardFactor {id: row.entity_id})
ON CREATE SET n.entity_id = row.entity_id, n.entity_type = row.entity_type, n.name = row.name,
              n.raw_name = row.raw_name, n.description = row.description, n.attributes_json = row.attributes_json,
              n.source_doc = row.source_doc, n.dataset_id = row.dataset_id, n.ontology_version = row.ontology_version,
              n.confidence = toFloat(row.confidence), n.review_status = row.review_status
SET n.entity_id = coalesce(n.entity_id, row.entity_id),
    n.entity_type = coalesce(n.entity_type, row.entity_type),
    n.name = CASE WHEN n.name IS NULL OR n.name = '' THEN row.name ELSE n.name END,
    n.hazard_reference_attributes_json = row.attributes_json,
    n.hazard_reference_dataset_id = row.dataset_id;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/01_entities.csv' AS row
WITH row WHERE row.entity_type = 'LossOfControlCondition' AND row.review_status = 'accepted'
MERGE (n:KGNode:LossOfControlCondition {id: row.entity_id})
ON CREATE SET n.entity_id = row.entity_id, n.entity_type = row.entity_type, n.name = row.name,
              n.raw_name = row.raw_name, n.description = row.description, n.attributes_json = row.attributes_json,
              n.source_doc = row.source_doc, n.dataset_id = row.dataset_id, n.ontology_version = row.ontology_version,
              n.confidence = toFloat(row.confidence), n.review_status = row.review_status
SET n.entity_id = coalesce(n.entity_id, row.entity_id),
    n.entity_type = coalesce(n.entity_type, row.entity_type),
    n.name = CASE WHEN n.name IS NULL OR n.name = '' THEN row.name ELSE n.name END,
    n.hazard_reference_attributes_json = row.attributes_json,
    n.hazard_reference_dataset_id = row.dataset_id;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'HAS_FAILURE_MODE' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:HAS_FAILURE_MODE {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'HAS_RELEASE_FACTOR' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:HAS_RELEASE_FACTOR {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'HAS_SUBCATEGORY' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:HAS_SUBCATEGORY {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'IN_DATASET' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:IN_DATASET {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'PART_OF_DOCUMENT' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:PART_OF_DOCUMENT {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///hazard_factor_reference_v1/02_relations.csv' AS row
WITH row WHERE row.relation_code = 'SUPPORTED_BY' AND row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:SUPPORTED_BY {id: row.relation_id}]->(t)
SET r.relation_id = row.relation_id, r.relation_name = row.relation_name,
    r.source_id = row.source_id, r.evidence_id = row.evidence_id,
    r.properties_json = row.properties_json, r.source_doc = row.source_doc,
    r.dataset_id = row.dataset_id, r.ontology_version = row.ontology_version,
    r.confidence = toFloat(row.confidence), r.review_status = row.review_status;

// Verification queries
MATCH (n:KGNode) WHERE n.hazard_reference_dataset_id = 'HAZARD_FACTOR_REFERENCE_V1' RETURN n.entity_type, count(*) ORDER BY count(*) DESC;
MATCH p=(a:HazardFactor)-[:HAS_SUBCATEGORY]->(b:HazardFactor)-[:HAS_FAILURE_MODE]->(m:LossOfControlCondition) RETURN p LIMIT 100;
MATCH p=(m:LossOfControlCondition)-[:HAS_RELEASE_FACTOR]->(f:HazardFactor) RETURN p LIMIT 100;
