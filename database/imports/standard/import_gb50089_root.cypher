CREATE CONSTRAINT kg_node_id IF NOT EXISTS FOR (n:KGNode) REQUIRE n.id IS UNIQUE;
LOAD CSV WITH HEADERS FROM 'file:///01_entities.csv' AS row
WITH row WHERE row.review_status = 'accepted'
MERGE (n:KGNode {id: row.entity_id})
SET n.entity_type = row.entity_type, n.name = row.name, n.attributes_json = row.attributes_json, n.review_status = row.review_status;
LOAD CSV WITH HEADERS FROM 'file:///02_relations.csv' AS row
WITH row WHERE row.review_status = 'accepted'
MATCH (h:KGNode {id: row.head_id})
MATCH (t:KGNode {id: row.tail_id})
MERGE (h)-[r:STANDARD_RULE {id: row.relation_id}]->(t)
SET r.relation_code = row.relation_code, r.properties_json = row.properties_json, r.review_status = row.review_status;
