// HAZOP_DA_H_R_V1 additive compatibility repair.
// Safe to run repeatedly. This script never removes nodes or relationships.

// 1. Nodes whose extracted ID does not collide with an existing KGNode.id.
MATCH (hz:KGNode)
WHERE hz.dataset_id = 'HAZOP_DA_H_R_V1'
  AND hz.id IS NULL
  AND hz.entity_id IS NOT NULL
  AND NOT EXISTS {
    MATCH (other:KGNode {id: hz.entity_id})
    WHERE elementId(other) <> elementId(hz)
  }
SET hz.id = hz.entity_id,
    hz.id_repair_status = 'direct',
    hz.id_repair_batch = 'HAZOP_ID_REPAIR_V2';

// 2. Extracted reference nodes whose logical entity already exists in the old graph.
// Keep the HAZOP mention for provenance and link it to the canonical old node.
MATCH (hz:KGNode)
WHERE hz.dataset_id = 'HAZOP_DA_H_R_V1'
  AND hz.id IS NULL
  AND hz.entity_id IS NOT NULL
MATCH (canonical:KGNode {id: hz.entity_id})
WHERE elementId(canonical) <> elementId(hz)
SET hz.id = 'HAZOP_REF_' + hz.entity_id,
    hz.canonical_id = canonical.id,
    hz.aligned_to_id = canonical.id,
    hz.alignment_status = 'exact_id_match',
    hz.id_repair_status = 'aligned_reference',
    hz.id_repair_batch = 'HAZOP_ID_REPAIR_V2'
MERGE (hz)-[alignment:ALIGNED_TO]->(canonical)
SET alignment.id = 'REL_ALIGN_' + hz.entity_id,
    alignment.relation_id = 'REL_ALIGN_' + hz.entity_id,
    alignment.relation_name = '实体对齐',
    alignment.dataset_id = 'HAZOP_DA_H_R_V1',
    alignment.ontology_version = '1.5-hazop',
    alignment.alignment_method = 'entity_id_exact',
    alignment.confidence = 1.0,
    alignment.review_status = 'auto_exact';

// 3. Give HAZOP relationships the same public id property used by the old graph.
MATCH ()-[r]->()
WHERE r.dataset_id = 'HAZOP_DA_H_R_V1'
  AND r.id IS NULL
  AND r.relation_id IS NOT NULL
  AND NOT EXISTS {
    MATCH ()-[other]->()
    WHERE other.id = r.relation_id
      AND elementId(other) <> elementId(r)
  }
SET r.id = r.relation_id,
    r.id_repair_status = 'direct',
    r.id_repair_batch = 'HAZOP_ID_REPAIR_V2';

MATCH ()-[r]->()
WHERE r.dataset_id = 'HAZOP_DA_H_R_V1'
  AND r.id IS NULL
  AND r.relation_id IS NOT NULL
SET r.id = 'HAZOP_REL_' + r.relation_id,
    r.original_relation_id = r.relation_id,
    r.id_repair_status = 'prefixed',
    r.id_repair_batch = 'HAZOP_ID_REPAIR_V2';

// 4. Materialize line codes for stable API filtering.
UNWIND [
  {entityId:'LINEHZ_593c323390e39a5243', lineCode:'DA', lineOrder:1},
  {entityId:'LINEHZ_7cf184f4c67ad58283', lineCode:'H',  lineOrder:2},
  {entityId:'LINEHZ_06576556d1ad802f24', lineCode:'R',  lineOrder:3}
] AS row
MATCH (line:KGNode:ProductionLine {entity_id: row.entityId})
SET line.line_code = row.lineCode,
    line.line_order = row.lineOrder;

// 5. Materialize source node codes and process order.
UNWIND [
  {entityId:'PROCHZ_838934a29835c43404', lineCode:'DA', nodeCode:'N001', processOrder:1},
  {entityId:'PROCHZ_c81fcefec024d838c9', lineCode:'DA', nodeCode:'N002', processOrder:2},
  {entityId:'PROCHZ_582090b27f2bddc7fd', lineCode:'DA', nodeCode:'N003', processOrder:3},
  {entityId:'PROCHZ_e350dd3b3f76d12260', lineCode:'DA', nodeCode:'N004', processOrder:4},
  {entityId:'PROCHZ_6a34712f2a6566454f', lineCode:'H',  nodeCode:'N001', processOrder:1},
  {entityId:'PROCHZ_80cc6279c1adbaffb2', lineCode:'H',  nodeCode:'N002', processOrder:2},
  {entityId:'PROCHZ_a67a164c23c7779f09', lineCode:'H',  nodeCode:'N003', processOrder:3},
  {entityId:'PROCHZ_60571b33e25a727433', lineCode:'H',  nodeCode:'N004', processOrder:4},
  {entityId:'PROCHZ_ddbb2b9e0e54ba1156', lineCode:'H',  nodeCode:'N005', processOrder:5},
  {entityId:'PROCHZ_14dc919f4a79dd003f', lineCode:'R',  nodeCode:'N001', processOrder:1},
  {entityId:'PROCHZ_c40e3056ba08c37f49', lineCode:'R',  nodeCode:'N002', processOrder:2},
  {entityId:'PROCHZ_a74eed99a962025e4c', lineCode:'R',  nodeCode:'N003', processOrder:3}
] AS row
MATCH (process:KGNode:Process {entity_id: row.entityId})
SET process.line_code = row.lineCode,
    process.node_code = row.nodeCode,
    process.process_order = row.processOrder;

// 6. Add the explicit production sequence. Exactly nine relationships are expected.
UNWIND [
  {from:'PROCHZ_838934a29835c43404', to:'PROCHZ_c81fcefec024d838c9', id:'RELHZ_NEXT_DA_N001_N002'},
  {from:'PROCHZ_c81fcefec024d838c9', to:'PROCHZ_582090b27f2bddc7fd', id:'RELHZ_NEXT_DA_N002_N003'},
  {from:'PROCHZ_582090b27f2bddc7fd', to:'PROCHZ_e350dd3b3f76d12260', id:'RELHZ_NEXT_DA_N003_N004'},
  {from:'PROCHZ_6a34712f2a6566454f', to:'PROCHZ_80cc6279c1adbaffb2', id:'RELHZ_NEXT_H_N001_N002'},
  {from:'PROCHZ_80cc6279c1adbaffb2', to:'PROCHZ_a67a164c23c7779f09', id:'RELHZ_NEXT_H_N002_N003'},
  {from:'PROCHZ_a67a164c23c7779f09', to:'PROCHZ_60571b33e25a727433', id:'RELHZ_NEXT_H_N003_N004'},
  {from:'PROCHZ_60571b33e25a727433', to:'PROCHZ_ddbb2b9e0e54ba1156', id:'RELHZ_NEXT_H_N004_N005'},
  {from:'PROCHZ_14dc919f4a79dd003f', to:'PROCHZ_c40e3056ba08c37f49', id:'RELHZ_NEXT_R_N001_N002'},
  {from:'PROCHZ_c40e3056ba08c37f49', to:'PROCHZ_a74eed99a962025e4c', id:'RELHZ_NEXT_R_N002_N003'}
] AS row
MATCH (source:KGNode:Process {entity_id: row.from})
MATCH (target:KGNode:Process {entity_id: row.to})
MERGE (source)-[r:NEXT_PROCESS {id: row.id}]->(target)
SET r.relation_id = row.id,
    r.relation_name = '下一工序',
    r.dataset_id = 'HAZOP_DA_H_R_V1',
    r.ontology_version = '1.5-hazop',
    r.confidence = 1.0,
    r.review_status = 'accepted',
    r.sequence_source = 'source_node_code';
