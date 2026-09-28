MATCH (n:KGNode)
RETURN coalesce(n.entity_type, 'missing') AS entity_type, count(n) AS count
ORDER BY count DESC
LIMIT 30;

MATCH (n:KGNode)
WHERE n.id STARTS WITH 'rule_' OR n.id STARTS WITH 'standard_node_' OR n.id STARTS WITH 'evidence_'
RETURN count(n) AS gb50089_style_nodes;

MATCH ()-[r]->()
RETURN type(r) AS relationship_type, count(r) AS count
ORDER BY count DESC
LIMIT 30;
