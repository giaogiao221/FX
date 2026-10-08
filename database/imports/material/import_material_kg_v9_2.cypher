// 危险物料知识图谱 V9.2 语义校验修正版
CREATE CONSTRAINT material_kgnode_id IF NOT EXISTS FOR (n:KGNode) REQUIRE n.id IS UNIQUE;
CREATE INDEX material_kgnode_type IF NOT EXISTS FOR (n:KGNode) ON (n.entity_type);
CREATE INDEX material_kgnode_name IF NOT EXISTS FOR (n:KGNode) ON (n.name);
CREATE FULLTEXT INDEX material_text_fulltext IF NOT EXISTS FOR (n:KGNode) ON EACH [n.name, n.raw_name, n.description];

LOAD CSV WITH HEADERS FROM 'file:///01_entities.csv' AS row
MERGE (n:KGNode {id:row.entity_id})
SET n.entity_type=row.entity_type, n.name=row.name, n.raw_name=row.raw_name,
    n.description=row.description, n.attributes_json=row.attributes_json,
    n.source_doc=row.source_doc, n.dataset_id=row.dataset_id,
    n.ontology_version=row.ontology_version, n.confidence=toFloatOrNull(row.confidence),
    n.review_status=row.review_status
FOREACH (_ IN CASE WHEN row.entity_type='ChemicalComponent' THEN [1] ELSE [] END | SET n:ChemicalComponent)
FOREACH (_ IN CASE WHEN row.entity_type='ComponentGroup' THEN [1] ELSE [] END | SET n:ComponentGroup)
FOREACH (_ IN CASE WHEN row.entity_type='ControlMeasure' THEN [1] ELSE [] END | SET n:ControlMeasure)
FOREACH (_ IN CASE WHEN row.entity_type='Dataset' THEN [1] ELSE [] END | SET n:Dataset)
FOREACH (_ IN CASE WHEN row.entity_type='Document' THEN [1] ELSE [] END | SET n:Document)
FOREACH (_ IN CASE WHEN row.entity_type='Evidence' THEN [1] ELSE [] END | SET n:Evidence)
FOREACH (_ IN CASE WHEN row.entity_type='ExposureLimit' THEN [1] ELSE [] END | SET n:ExposureLimit)
FOREACH (_ IN CASE WHEN row.entity_type='ExposureRoute' THEN [1] ELSE [] END | SET n:ExposureRoute)
FOREACH (_ IN CASE WHEN row.entity_type='FirefightingAgent' THEN [1] ELSE [] END | SET n:FirefightingAgent)
FOREACH (_ IN CASE WHEN row.entity_type='FirefightingMeasure' THEN [1] ELSE [] END | SET n:FirefightingMeasure)
FOREACH (_ IN CASE WHEN row.entity_type='FirstAidMeasure' THEN [1] ELSE [] END | SET n:FirstAidMeasure)
FOREACH (_ IN CASE WHEN row.entity_type='HazardClassification' THEN [1] ELSE [] END | SET n:HazardClassification)
FOREACH (_ IN CASE WHEN row.entity_type='HazardFactor' THEN [1] ELSE [] END | SET n:HazardFactor)
FOREACH (_ IN CASE WHEN row.entity_type='HealthEffect' THEN [1] ELSE [] END | SET n:HealthEffect)
FOREACH (_ IN CASE WHEN row.entity_type='HealthHazard' THEN [1] ELSE [] END | SET n:HealthHazard)
FOREACH (_ IN CASE WHEN row.entity_type='Material' THEN [1] ELSE [] END | SET n:Material)
FOREACH (_ IN CASE WHEN row.entity_type='MaterialCategory' THEN [1] ELSE [] END | SET n:MaterialCategory)
FOREACH (_ IN CASE WHEN row.entity_type='MaterialFamily' THEN [1] ELSE [] END | SET n:MaterialFamily)
FOREACH (_ IN CASE WHEN row.entity_type='MaterialProperty' THEN [1] ELSE [] END | SET n:MaterialProperty)
FOREACH (_ IN CASE WHEN row.entity_type='PropertyMeasurement' THEN [1] ELSE [] END | SET n:PropertyMeasurement)
FOREACH (_ IN CASE WHEN row.entity_type='SpillResponseMeasure' THEN [1] ELSE [] END | SET n:SpillResponseMeasure)
FOREACH (_ IN CASE WHEN row.entity_type='StorageTransportRequirement' THEN [1] ELSE [] END | SET n:StorageTransportRequirement);

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='ALLOWS_FIREFIGHTING_AGENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:ALLOWS_FIREFIGHTING_AGENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='BELONGS_TO_CATEGORY'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:BELONGS_TO_CATEGORY {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='CAUSES_HEALTH_EFFECT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:CAUSES_HEALTH_EFFECT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='CAUSES_HEALTH_HAZARD'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:CAUSES_HEALTH_HAZARD {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='CONTAINS'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:CONTAINS {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='CONTAINS_COMPONENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:CONTAINS_COMPONENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_EXPOSURE_LIMIT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_EXPOSURE_LIMIT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_EXPOSURE_ROUTE'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_EXPOSURE_ROUTE {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_HAZARD'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_HAZARD {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_HAZARD_CLASS'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_HAZARD_CLASS {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_MATERIAL_PROPERTY'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_MATERIAL_PROPERTY {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_MEASUREMENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_MEASUREMENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='HAS_VARIANT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:HAS_VARIANT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='INCOMPATIBLE_WITH'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:INCOMPATIBLE_WITH {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='INEFFECTIVE_FIREFIGHTING_AGENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:INEFFECTIVE_FIREFIGHTING_AGENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='IN_DATASET'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:IN_DATASET {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='PART_OF_DOCUMENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:PART_OF_DOCUMENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='PROHIBITS_CONTROL_METHOD'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:PROHIBITS_CONTROL_METHOD {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='PROHIBITS_FIREFIGHTING_AGENT'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:PROHIBITS_FIREFIGHTING_AGENT {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='REQUIRES_CONTROL_MEASURE'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:REQUIRES_CONTROL_MEASURE {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='REQUIRES_FIREFIGHTING'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:REQUIRES_FIREFIGHTING {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='REQUIRES_FIRST_AID'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:REQUIRES_FIRST_AID {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='REQUIRES_SPILL_RESPONSE'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:REQUIRES_SPILL_RESPONSE {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='REQUIRES_STORAGE_CONTROL'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:REQUIRES_STORAGE_CONTROL {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.relation_code='SUPPORTED_BY'
MATCH (h:KGNode {id:row.head_id}), (t:KGNode {id:row.tail_id})
MERGE (h)-[r:SUPPORTED_BY {id:row.relation_id}]->(t)
SET r.relation_name=row.relation_name, r.source_id=row.source_id,
    r.evidence_id=row.evidence_id, r.properties_json=row.properties_json,
    r.source_doc=row.source_doc, r.dataset_id=row.dataset_id,
    r.ontology_version=row.ontology_version, r.confidence=toFloatOrNull(row.confidence),
    r.review_status=row.review_status;

// 写入经字段专用校验的主数值；numeric_validated=false 时不会写入错误数值
LOAD CSV WITH HEADERS FROM 'file:///05_material_properties.csv' AS row
MATCH (p:MaterialProperty {id:row.property_id})
SET p.material_id=row.material_id, p.property_group=row.property_group,
    p.property_name=row.property_name, p.raw_value=row.raw_value,
    p.value=CASE WHEN row.numeric_validated='true' THEN toFloatOrNull(row.value_num) ELSE null END,
    p.min_value=CASE WHEN row.numeric_validated='true' THEN toFloatOrNull(row.min_value_num) ELSE null END,
    p.max_value=CASE WHEN row.numeric_validated='true' THEN toFloatOrNull(row.max_value_num) ELSE null END,
    p.unit=row.unit, p.qualifier=row.qualifier, p.qualitative_level=row.qualitative_level,
    p.parse_status=row.parse_status, p.numeric_validated=(row.numeric_validated='true'),
    p.numeric_issue=row.numeric_issue, p.test_metric=row.test_metric,
    p.test_hammer_mass_kg=toFloatOrNull(row.test_hammer_mass_kg),
    p.test_duration_s=toFloatOrNull(row.test_duration_s), p.source_row=toIntegerOrNull(row.source_row);

// 多测量值节点和HAS_MEASUREMENT关系已由01/02导入，此处写入原生数值
LOAD CSV WITH HEADERS FROM 'file:///16_property_measurements.csv' AS row
MATCH (m:PropertyMeasurement:KGNode {id:row.measurement_id})
SET m.measurement_role=row.measurement_role, m.value=toFloatOrNull(row.value_num),
    m.min_value=toFloatOrNull(row.min_value_num), m.max_value=toFloatOrNull(row.max_value_num),
    m.unit=row.unit, m.operator=row.operator, m.test_metric=row.test_metric,
    m.context_text=row.context_text, m.evidence_id=row.evidence_id,
    m.review_status=row.review_status, m.ontology_version='1.4-material';

LOAD CSV WITH HEADERS FROM 'file:///06_components.csv' AS row
MATCH ()-[r:CONTAINS_COMPONENT {id:row.component_relation_id}]->()
SET r.min_pct=toFloatOrNull(row.min_pct), r.max_pct=toFloatOrNull(row.max_pct),
    r.nominal_pct=toFloatOrNull(row.nominal_pct), r.tolerance_pct=toFloatOrNull(row.tolerance_pct),
    r.amount_qualifier=row.amount_qualifier, r.component_specificity=row.component_specificity,
    r.example_text=row.example_text, r.is_incomplete_list=(row.is_incomplete_list='true');

// 仅使用已校验主数值查询
MATCH (m:Material)-[:HAS_MATERIAL_PROPERTY]->(p:MaterialProperty)
WHERE p.numeric_validated=true RETURN m.name,p.property_name,p.value,p.min_value,p.max_value,p.unit LIMIT 100;